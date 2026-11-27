import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { logActivity, notify } from "./activity";
import { emailUser } from "./email";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type App = { id: string; reference: string; clientId: string; consultantId: string | null; stage: string };

/**
 * Makes `consultant` the application's one primary consultant. Records history, closes other pending requests,
 * notifies the consultant, the previous consultant and the client. Call inside a transaction.
 */
export async function assignInTx(tx: Tx, app: App, consultant: { id: string; name: string }, by: { id: string; name: string }, kind: "ASSIGNED" | "REASSIGNED" | "REQUEST_APPROVED" | "SELF_ASSIGNED", reason?: string | null) {
  const nextStage = app.stage === "SUBMITTED" ? "ELIGIBILITY_REVIEW" : app.stage;
  await tx.update(s.applications).set({ consultantId: consultant.id, stage: nextStage as "ELIGIBILITY_REVIEW" }).where(eq(s.applications.id, app.id));
  await tx.insert(s.assignmentHistory).values({ applicationId: app.id, fromConsultantId: app.consultantId, toConsultantId: consultant.id, kind, reason: reason ?? null, changedById: by.id });
  await tx.update(s.assignmentRequests).set({ status: "REJECTED", note: `Assigned to ${consultant.name}`, decidedById: by.id, decidedAt: new Date() })
    .where(and(eq(s.assignmentRequests.applicationId, app.id), eq(s.assignmentRequests.status, "PENDING"), ne(s.assignmentRequests.consultantId, consultant.id)));
  await logActivity(tx, { actorId: by.id, action: kind === "SELF_ASSIGNED" ? "application.self_assigned" : kind === "REQUEST_APPROVED" ? "assignment.request_approved" : app.consultantId ? "application.reassigned" : "application.assigned", entityType: "application", entityId: app.id, applicationId: app.id,
    summary: kind === "SELF_ASSIGNED" ? `${consultant.name} assigned ${app.reference} to themselves` : kind === "REQUEST_APPROVED" ? `${by.name} approved ${consultant.name}'s request to serve ${app.reference}` : `${by.name} ${app.consultantId ? "reassigned" : "assigned"} ${app.reference} to ${consultant.name}${reason ? `: ${reason}` : ""}`,
    changes: { consultant: [app.consultantId, consultant.id], stage: [app.stage, nextStage] } });
  if (kind === "SELF_ASSIGNED") await notify(tx, { role: "ADMIN", title: "Client self-assigned", body: `${consultant.name} assigned ${app.reference} to themselves.`, link: `/staff/assignments?tab=history` });
  await notify(tx, { userId: consultant.id, title: kind === "SELF_ASSIGNED" ? "You're now responsible for this client" : kind === "REQUEST_APPROVED" ? "Request approved: client assigned to you" : "Application assigned to you", body: app.reference, link: `/staff/applications/${app.id}` });
  if (app.consultantId && app.consultantId !== consultant.id) await notify(tx, { userId: app.consultantId, title: "Application reassigned", body: `${app.reference} is now handled by ${consultant.name}.`, link: "/staff/applications" });
  await notify(tx, { userId: app.clientId, title: "Your consultant", body: `${consultant.name} is now handling ${app.reference}.`, link: `/portal/applications/${app.id}` });
}

export async function afterAssign(app: App, consultant: { name: string }) {
  await emailUser(app.clientId, `Your FIRST FLIGHT consultant for ${app.reference}`, `${consultant.name} is now your consultant for application ${app.reference}. You can follow every step in your client portal.`, `/portal/applications/${app.id}`);
}

/** Loads an application row locked for update, so two assignment decisions can't run at once. */
export async function lockApp(tx: Tx, id: string) {
  const [a] = await tx.select().from(s.applications).where(eq(s.applications.id, id)).for("update");
  return a ?? null;
}

/** An active consultant who holds the service. */
export async function eligibleConsultant(id: string, service: string) {
  const [k] = await db.select({ id: s.users.id, name: s.users.name }).from(s.users)
    .innerJoin(s.consultantServices, and(eq(s.consultantServices.userId, s.users.id), eq(s.consultantServices.service, service)))
    .where(and(eq(s.users.id, id), eq(s.users.role, "CONSULTANT"), eq(s.users.active, true)));
  return k ?? null;
}
