"use server";
// Client assignment: consultants request unassigned clients; admins approve, reject, assign directly, reassign or unassign.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { hasService } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { afterAssign, assignInTx, eligibleConsultant, lockApp } from "@/lib/assignment";
import { SERVICE_LABEL } from "@/lib/format";

export type AsgState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);
const refresh = (appId?: string) => { for (const p of ["/staff/available", "/staff/assignments", "/staff/applications", "/staff"]) revalidatePath(p); if (appId) revalidatePath(`/staff/applications/${appId}`); };

export async function requestToServe(_: AsgState, fd: FormData): Promise<AsgState> {
  const me = await requireUser(["CONSULTANT"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || app.status !== "ACTIVE") return { error: "This application is no longer open." };
  if (!hasService(me, app.service)) return { error: `You're not authorised for ${SERVICE_LABEL[app.service]}. Ask an administrator for access.` };
  if (app.consultantId) return { error: "This client already has a consultant." };
  const mine = await db.query.assignmentRequests.findFirst({ where: and(eq(s.assignmentRequests.applicationId, app.id), eq(s.assignmentRequests.consultantId, me.id), eq(s.assignmentRequests.status, "PENDING")) });
  if (mine) return { error: "You already asked to serve this client. Your request is waiting for an administrator." };
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(s.assignmentRequests).values({ applicationId: app.id, consultantId: me.id, note: str(fd, "note") || null }).returning();
    await logActivity(tx, { actorId: me.id, action: "assignment.requested", entityType: "assignment_request", entityId: r.id, applicationId: app.id, summary: `${me.name} asked to serve ${app.reference}` });
    await notify(tx, { role: "ADMIN", title: "Request to serve a client", body: `${me.name} asked to serve ${app.reference}.`, link: "/staff/assignments" });
  });
  refresh();
  return { ok: "Request sent. An administrator will approve or reject it." };
}

export async function withdrawRequest(_: AsgState, fd: FormData): Promise<AsgState> {
  const me = await requireUser(["CONSULTANT"]);
  const r = await db.query.assignmentRequests.findFirst({ where: and(eq(s.assignmentRequests.id, str(fd, "requestId", 64)), eq(s.assignmentRequests.consultantId, me.id), eq(s.assignmentRequests.status, "PENDING")) });
  if (!r) return { error: "This request is no longer pending." };
  await db.update(s.assignmentRequests).set({ status: "WITHDRAWN", decidedAt: new Date() }).where(eq(s.assignmentRequests.id, r.id));
  refresh();
  return { ok: "Request withdrawn." };
}

export async function decideRequest(_: AsgState, fd: FormData): Promise<AsgState> {
  const admin = await requireUser(["ADMIN"]);
  const req = await db.query.assignmentRequests.findFirst({ where: eq(s.assignmentRequests.id, str(fd, "requestId", 64)), with: { consultant: { columns: { id: true, name: true } } } });
  if (!req || req.status !== "PENDING") return { error: "This request has already been decided." };
  const approve = fd.get("decision") === "approve";
  const note = str(fd, "note");
  if (!approve) {
    if (note.length < 3) return { error: "Give the consultant a short reason." };
    const app = await db.query.applications.findFirst({ where: eq(s.applications.id, req.applicationId), columns: { reference: true } });
    await db.transaction(async (tx) => {
      await tx.update(s.assignmentRequests).set({ status: "REJECTED", note, decidedById: admin.id, decidedAt: new Date() }).where(eq(s.assignmentRequests.id, req.id));
      await logActivity(tx, { actorId: admin.id, action: "assignment.request_rejected", entityType: "assignment_request", entityId: req.id, applicationId: req.applicationId, summary: `${admin.name} rejected ${req.consultant.name}'s request to serve ${app?.reference}: ${note}` });
      await notify(tx, { userId: req.consultantId, title: "Request to serve not approved", body: `${app?.reference}: ${note}`, link: "/staff/available" });
    });
    refresh(req.applicationId);
    return { ok: "Request rejected. The client stays unassigned." };
  }
  const k = await eligibleConsultant(req.consultantId, (await db.query.applications.findFirst({ where: eq(s.applications.id, req.applicationId), columns: { service: true } }))!.service);
  if (!k) return { error: `${req.consultant.name} is no longer active or no longer has access to this service.` };
  const res = await db.transaction(async (tx) => {
    const app = await lockApp(tx, req.applicationId);
    if (!app || app.status !== "ACTIVE") return { error: "This application is closed." };
    if (app.consultantId) return { error: "This client was assigned to someone else in the meantime." };
    await tx.update(s.assignmentRequests).set({ status: "APPROVED", note: note || null, decidedById: admin.id, decidedAt: new Date() }).where(eq(s.assignmentRequests.id, req.id));
    await assignInTx(tx, app, k, admin, "REQUEST_APPROVED", note || null);
    return { app };
  });
  if ("error" in res) return { error: res.error };
  await afterAssign(res.app, k);
  refresh(req.applicationId);
  return { ok: `Approved: ${res.app.reference} is now assigned to ${k.name}.` };
}

/** Admin assigns or reassigns directly, without waiting for a request. */
export async function directAssign(_: AsgState, fd: FormData): Promise<AsgState> {
  const admin = await requireUser(["ADMIN"]);
  const appId = str(fd, "applicationId", 64);
  const base = await db.query.applications.findFirst({ where: eq(s.applications.id, appId), columns: { service: true } });
  if (!base) return { error: "Application not found." };
  const k = await eligibleConsultant(str(fd, "consultantId", 64), base.service);
  if (!k) return { error: `Choose an active consultant who has access to ${SERVICE_LABEL[base.service]}.` };
  const reason = str(fd, "reason") || null;
  const res = await db.transaction(async (tx) => {
    const app = await lockApp(tx, appId);
    if (!app || app.status !== "ACTIVE") return { error: "This application is closed." };
    if (app.consultantId === k.id) return { error: `${k.name} is already the consultant.` };
    if (app.consultantId && !reason) return { error: "Give a reason for reassigning; it's kept in the assignment history." };
    await assignInTx(tx, app, k, admin, app.consultantId ? "REASSIGNED" : "ASSIGNED", reason);
    return { app };
  });
  if ("error" in res) return { error: res.error };
  await afterAssign(res.app, k);
  refresh(appId);
  return { ok: `${res.app.reference} is now assigned to ${k.name}.` };
}

/** Admin removes the consultant; the client goes back to the available list. */
export async function unassign(_: AsgState, fd: FormData): Promise<AsgState> {
  const admin = await requireUser(["ADMIN"]);
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Give a reason for removing the assignment." };
  const appId = str(fd, "applicationId", 64);
  const res = await db.transaction(async (tx) => {
    const app = await lockApp(tx, appId);
    if (!app?.consultantId) return { error: "This application has no consultant." };
    await tx.update(s.applications).set({ consultantId: null }).where(eq(s.applications.id, app.id));
    await tx.insert(s.assignmentHistory).values({ applicationId: app.id, fromConsultantId: app.consultantId, toConsultantId: null, kind: "UNASSIGNED", reason, changedById: admin.id });
    await logActivity(tx, { actorId: admin.id, action: "application.unassigned", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${admin.name} removed the consultant from ${app.reference}: ${reason}` });
    await notify(tx, { userId: app.consultantId, title: "Application removed from you", body: `${app.reference}: ${reason}`, link: "/staff/applications" });
    return { app };
  });
  if ("error" in res) return { error: res.error };
  refresh(appId);
  return { ok: `${res.app.reference} is unassigned and available to consultants again.` };
}
