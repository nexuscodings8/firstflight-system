"use server";
// Office visit invitations: the assigned consultant (or an admin) invites, the client accepts, continues remotely
// (only when the consultant allowed it) or declines, and the consultant marks the visit completed.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { getOffice } from "@/lib/settings";
import { SERVICE_LABEL, STAGES, STAGE_LABEL, kigaliTime } from "@/lib/format";
import { kigaliToDate, type OfficeSnap } from "@/lib/appointments";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);
const refresh = (id: string) => { revalidatePath(`/portal/applications/${id}`); revalidatePath(`/staff/applications/${id}`); revalidatePath("/portal"); };

export async function inviteToOffice(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || !canWorkOnCase(user, app)) return { error: "You can't work on this application." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  if (!app.consultantId) return { error: "Assign a consultant first: the invitation is from them." };
  const reason = str(fd, "reason", 500);
  if (reason.length < 5) return { error: "Say why the client should come in." };
  const at = kigaliToDate(str(fd, "date", 10), str(fd, "time", 5));
  if (!at) return { error: "Choose a date and time." };
  if (+at < Date.now() + 30 * 60_000) return { error: "Choose a time at least 30 minutes from now." };
  const stage = str(fd, "expectedStage", 40);
  const expectedStage = (STAGES as readonly string[]).includes(stage) ? stage : null;
  const remoteAllowed = fd.get("remoteAllowed") === "on";
  const o = await getOffice();
  const office: OfficeSnap = { address: o.address, mapsUrl: o.mapsUrl, phone: o.phone, hours: o.hours };
  await db.transaction(async (tx) => {
    const [a] = await tx.insert(s.appointments).values({ applicationId: app.id, consultantId: app.consultantId!, reason, startsAt: at, expectedStage, remoteAllowed, office }).returning({ id: s.appointments.id });
    await logActivity(tx, { actorId: user.id, action: "appointment.invited", entityType: "appointment", entityId: a.id, applicationId: app.id, summary: `${user.name} invited the client of ${app.reference} to the office on ${kigaliTime(at)}` });
    await notify(tx, { userId: app.clientId, title: "Invitation to the FIRST FLIGHT office", body: `${kigaliTime(at)}: ${reason}`, link: `/portal/applications/${app.id}#appointments` });
  });
  const [client] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, app.clientId));
  const [k] = await db.select({ name: s.users.name, email: s.users.email, phone: s.users.phone }).from(s.users).where(eq(s.users.id, app.consultantId));
  await emailUser(app.clientId, `Office appointment for ${app.reference}`, `Dear ${client?.name ?? "client"},\n\nYour consultant invites you to the FIRST FLIGHT office.\n\nApplication: ${app.reference} (${SERVICE_LABEL[app.service]})\nCurrent stage: ${STAGE_LABEL[app.stage]}\nWhy: ${reason}\nWhen: ${kigaliTime(at)}${expectedStage ? `\nNext stage after the visit: ${STAGE_LABEL[expectedStage]}` : ""}\n\nWhere: ${office.address}\nMap: ${office.mapsUrl}\nOffice: ${office.phone} · ${office.hours}\n\nYour consultant: ${k?.name ?? ""}${k?.phone ? ` · ${k.phone}` : ""}${k?.email ? ` · ${k.email}` : ""}\n\nPlease accept${remoteAllowed ? ", or choose to continue remotely if you can't come," : ""} in your client portal.`, `/portal/applications/${app.id}#appointments`);
  refresh(app.id);
  return { ok: "Invitation sent. The client has been notified." };
}

export async function respondToAppointment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const a = await db.query.appointments.findFirst({ where: eq(s.appointments.id, str(fd, "appointmentId", 64)), with: { application: { columns: { id: true, clientId: true, reference: true } } } });
  if (!a || a.application.clientId !== user.id) return { error: "Invitation not found." };
  if (a.status !== "PENDING") return { error: "You've already answered this invitation." };
  const choice = str(fd, "choice", 10);
  const status = choice === "accept" ? "ACCEPTED" : choice === "remote" ? "REMOTE" : choice === "decline" ? "DECLINED" : null;
  if (!status) return { error: "Choose an answer." };
  if (status === "REMOTE" && !a.remoteAllowed) return { error: "Your consultant needs you at the office for this step." };
  const note = str(fd, "note", 500);
  if (status === "DECLINED" && note.length < 3) return { error: "Tell your consultant why, or suggest another time." };
  const what = status === "ACCEPTED" ? "accepted the office visit" : status === "REMOTE" ? "chose to continue remotely" : "declined the office visit";
  await db.transaction(async (tx) => {
    await tx.update(s.appointments).set({ status, clientNote: note || null, respondedAt: new Date() }).where(eq(s.appointments.id, a.id));
    await logActivity(tx, { actorId: user.id, action: `appointment.${status.toLowerCase()}`, entityType: "appointment", entityId: a.id, applicationId: a.application.id, summary: `${user.name} ${what} (${a.application.reference})` });
    await notify(tx, { userId: a.consultantId, title: `Client ${what}`, body: `${a.application.reference}, ${kigaliTime(a.startsAt)}${note ? `: ${note}` : ""}`, link: `/staff/applications/${a.application.id}#appointments` });
  });
  await emailUser(a.consultantId, `${a.application.reference}: client ${what}`, `${user.name} ${what} for ${kigaliTime(a.startsAt)}.${note ? `\n\nNote: ${note}` : ""}`, `/staff/applications/${a.application.id}`);
  refresh(a.application.id);
  return { ok: status === "ACCEPTED" ? "Thank you. We'll see you at the office." : status === "REMOTE" ? "Noted. Your consultant will continue with you remotely." : "Your consultant has been told." };
}

export async function closeAppointment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const a = await db.query.appointments.findFirst({ where: eq(s.appointments.id, str(fd, "appointmentId", 64)), with: { application: true } });
  if (!a || !canWorkOnCase(user, a.application)) return { error: "You can't work on this application." };
  const action = str(fd, "action", 10);
  if (action === "complete" && !["ACCEPTED", "REMOTE"].includes(a.status)) return { error: "Only accepted or remote appointments can be completed." };
  if (action === "cancel" && a.status !== "PENDING" && a.status !== "ACCEPTED") return { error: "This appointment can't be cancelled now." };
  if (action !== "complete" && action !== "cancel") return { error: "Choose an action." };
  const status = action === "complete" ? "COMPLETED" : "CANCELLED";
  await db.transaction(async (tx) => {
    await tx.update(s.appointments).set({ status }).where(eq(s.appointments.id, a.id));
    await logActivity(tx, { actorId: user.id, action: `appointment.${action === "complete" ? "completed" : "cancelled"}`, entityType: "appointment", entityId: a.id, applicationId: a.application.id, summary: `${user.name} marked the ${kigaliTime(a.startsAt)} appointment ${status.toLowerCase()} (${a.application.reference})` });
    if (status === "CANCELLED") await notify(tx, { userId: a.application.clientId, title: "Appointment cancelled", body: `${a.application.reference}: the ${kigaliTime(a.startsAt)} appointment is cancelled.`, link: `/portal/applications/${a.application.id}#appointments` });
  });
  refresh(a.application.id);
  return { ok: status === "COMPLETED" ? "Appointment marked completed." : "Appointment cancelled; the client has been told." };
}
