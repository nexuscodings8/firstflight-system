"use server";
// Consultant (and admin) case work on one application. Every action re-checks access on the server,
// writes the change and its activity record in one transaction, then notifies and emails after it commits.
import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { STAGES, STAGE_LABEL, label } from "@/lib/format";

export type CaseState = { ok?: string; error?: string } | undefined;

const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);

async function loadCase(appId: string) {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, appId) });
  if (!app || !canWorkOnCase(user, app)) return { user, app: null };
  return { user, app };
}

const refresh = (id: string) => { revalidatePath(`/staff/applications/${id}`); revalidatePath(`/portal/applications/${id}`); revalidatePath("/staff"); };
const clientLink = (id: string) => `/portal/applications/${id}`;

/** Verify or reject one checklist item. A rejection needs a reason the client will see. */
export async function reviewDocument(_: CaseState, fd: FormData): Promise<CaseState> {
  const { user, app } = await loadCase(str(fd, "applicationId", 64));
  if (!app) return { error: "You can't work on this application." };
  const decision = str(fd, "decision", 10);
  const reason = str(fd, "reason", 500);
  if (decision !== "verify" && decision !== "reject") return { error: "Choose verify or reject." };
  if (decision === "reject" && reason.length < 5) return { error: "Tell the client why, so they know what to upload instead." };
  const item = await db.query.checklistItems.findFirst({ where: and(eq(s.checklistItems.id, str(fd, "itemId", 64)), eq(s.checklistItems.applicationId, app.id)), with: { documents: { columns: { id: true } } } });
  if (!item) return { error: "That checklist item no longer exists." };
  if (!item.documents.length) return { error: "Nothing has been uploaded for this item yet." };
  const state = decision === "verify" ? "VERIFIED" : "REJECTED";
  await db.transaction(async (tx) => {
    await tx.update(s.checklistItems).set({ state, note: decision === "reject" ? reason : null }).where(eq(s.checklistItems.id, item.id));
    await logActivity(tx, { actorId: user.id, action: decision === "verify" ? "document.verified" : "document.rejected", entityType: "checklist_item", entityId: item.id, applicationId: app.id,
      summary: `${user.name} ${decision === "verify" ? "verified" : "rejected"} "${item.label}" on ${app.reference}`, changes: { state: [item.state, state], reason: decision === "reject" ? reason : undefined } });
    await notify(tx, { userId: app.clientId, title: decision === "verify" ? "Document verified" : "Document needs re-uploading", body: decision === "verify" ? `${item.label} (${app.reference}) was accepted.` : `${item.label} (${app.reference}): ${reason}`, link: clientLink(app.id) });
  });
  if (decision === "reject") await emailUser(app.clientId, `Please re-upload: ${item.label}`, `Your consultant checked "${item.label}" for application ${app.reference} and needs a new copy.\n\nReason: ${reason}`, clientLink(app.id));
  refresh(app.id);
  return { ok: decision === "verify" ? `${item.label} verified.` : `${item.label} rejected; the client has been told why.` };
}

/** Ask the client for a document that isn't on the checklist yet. */
export async function requestDocument(_: CaseState, fd: FormData): Promise<CaseState> {
  const { user, app } = await loadCase(str(fd, "applicationId", 64));
  if (!app) return { error: "You can't work on this application." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  const docLabel = str(fd, "label", 150), note = str(fd, "note", 500), mandatory = fd.get("mandatory") === "on";
  if (docLabel.length < 3) return { error: "Name the document you need." };
  const [{ top }] = await db.select({ top: max(s.checklistItems.sortOrder) }).from(s.checklistItems).where(eq(s.checklistItems.applicationId, app.id));
  await db.transaction(async (tx) => {
    const [item] = await tx.insert(s.checklistItems).values({ applicationId: app.id, label: docLabel, mandatory, note: note || null, state: "REQUESTED", requestedById: user.id, sortOrder: (top ?? 0) + 1 }).returning({ id: s.checklistItems.id });
    await logActivity(tx, { actorId: user.id, action: "document.requested", entityType: "checklist_item", entityId: item.id, applicationId: app.id, summary: `${user.name} requested "${docLabel}" on ${app.reference}` });
    await notify(tx, { userId: app.clientId, title: "Document requested", body: `${docLabel} for ${app.reference}${note ? `: ${note}` : ""}`, link: clientLink(app.id) });
  });
  await emailUser(app.clientId, `Document requested: ${docLabel}`, `Your consultant needs "${docLabel}" for application ${app.reference}.${note ? `\n\n${note}` : ""}\n\nUpload it from your client portal.`, clientLink(app.id));
  refresh(app.id);
  return { ok: `Requested "${docLabel}". The client has been notified.` };
}

const STATUSES = ["ACTIVE", "COMPLETED", "NOT_ELIGIBLE", "UNSUCCESSFUL", "WITHDRAWN"] as const;

/** Move the application to another stage and/or close it, with an optional message to the client. */
export async function updateProgress(_: CaseState, fd: FormData): Promise<CaseState> {
  const { user, app } = await loadCase(str(fd, "applicationId", 64));
  if (!app) return { error: "You can't work on this application." };
  const stage = str(fd, "stage", 40) as (typeof STAGES)[number];
  const status = str(fd, "status", 40) as (typeof STATUSES)[number];
  const message = str(fd, "message", 2000);
  if (!STAGES.includes(stage) || !STATUSES.includes(status)) return { error: "Choose a stage and a status." };
  const finalStage = status === "COMPLETED" ? "COMPLETED" : stage;
  if (finalStage === app.stage && status === app.status) return { error: "Nothing changed." };
  if (status !== "ACTIVE" && status !== "COMPLETED" && message.length < 5) return { error: "Explain the decision to the client in the message box." };
  const what = status === "ACTIVE" ? `moved to ${STAGE_LABEL[finalStage]}` : `marked ${label(status).toLowerCase()}`;
  await db.transaction(async (tx) => {
    await tx.update(s.applications).set({ stage: finalStage, status }).where(eq(s.applications.id, app.id));
    if (message) await tx.insert(s.applicationUpdates).values({ applicationId: app.id, authorId: user.id, body: message, visibility: "CLIENT" });
    await logActivity(tx, { actorId: user.id, action: "application.progress", entityType: "application", entityId: app.id, applicationId: app.id,
      summary: `${user.name} ${what}: ${app.reference}`, changes: { stage: [app.stage, finalStage], status: [app.status, status] } });
    await notify(tx, { userId: app.clientId, title: "Application updated", body: `${app.reference} ${what}.`, link: clientLink(app.id) });
  });
  await emailUser(app.clientId, `Update on ${app.reference}`, `Your application ${app.reference} has been ${what}.${message ? `\n\nMessage from your consultant:\n${message}` : ""}`, clientLink(app.id));
  refresh(app.id);
  return { ok: `Application ${what}.` };
}

/** Post a client-visible update or an internal note (internal notes are never shown or sent to the client). */
export async function postUpdate(_: CaseState, fd: FormData): Promise<CaseState> {
  const { user, app } = await loadCase(str(fd, "applicationId", 64));
  if (!app) return { error: "You can't work on this application." };
  const body = str(fd, "body", 4000);
  const visibility = fd.get("visibility") === "INTERNAL" ? "INTERNAL" : "CLIENT";
  if (body.length < 2) return { error: "Write a message first." };
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(s.applicationUpdates).values({ applicationId: app.id, authorId: user.id, body, visibility }).returning({ id: s.applicationUpdates.id });
    await logActivity(tx, { actorId: user.id, action: visibility === "INTERNAL" ? "note.internal" : "update.client", entityType: "application_update", entityId: u.id, applicationId: app.id,
      summary: `${user.name} ${visibility === "INTERNAL" ? "added an internal note to" : "posted an update on"} ${app.reference}` });
    if (visibility === "CLIENT") await notify(tx, { userId: app.clientId, title: "New update from your consultant", body: `${app.reference}: ${body.slice(0, 140)}`, link: clientLink(app.id) });
  });
  if (visibility === "CLIENT") await emailUser(app.clientId, `New update on ${app.reference}`, body, clientLink(app.id));
  refresh(app.id);
  return { ok: visibility === "INTERNAL" ? "Internal note saved. Only staff can see it." : "Update posted. The client has been notified." };
}
