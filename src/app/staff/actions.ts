"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canAssign } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";

/** Admin assigns or reassigns an application to a consultant. */
export async function assignConsultant(fd: FormData) {
  const admin = await requireUser(["ADMIN"]);
  if (!canAssign(admin)) return;
  const appId = String(fd.get("applicationId") ?? ""), consultantId = String(fd.get("consultantId") ?? "");
  const [app, consultant] = await Promise.all([
    db.query.applications.findFirst({ where: eq(s.applications.id, appId), with: { consultant: { columns: { name: true } } } }),
    db.query.users.findFirst({ where: and(eq(s.users.id, consultantId), eq(s.users.role, "CONSULTANT"), eq(s.users.active, true)) }),
  ]);
  if (!app || !consultant || app.consultantId === consultant.id) return;
  await db.transaction(async (tx) => {
    await tx.update(s.applications).set({ consultantId: consultant.id, stage: app.stage === "SUBMITTED" ? "ELIGIBILITY_REVIEW" : app.stage }).where(eq(s.applications.id, app.id));
    await logActivity(tx, { actorId: admin.id, action: app.consultantId ? "application.reassigned" : "application.assigned", entityType: "application", entityId: app.id, applicationId: app.id,
      summary: `${admin.name} ${app.consultantId ? "reassigned" : "assigned"} ${app.reference} to ${consultant.name}`, changes: { consultant: [app.consultant?.name ?? null, consultant.name], stage: [app.stage, app.stage === "SUBMITTED" ? "ELIGIBILITY_REVIEW" : app.stage] } });
    await notify(tx, { userId: consultant.id, title: "Application assigned to you", body: `${app.reference}`, link: `/staff/applications/${app.id}` });
    await notify(tx, { userId: app.clientId, title: "Your consultant is assigned", body: `${consultant.name} is now handling ${app.reference}.`, link: `/portal/applications/${app.id}` });
  });
  revalidatePath("/staff");
  revalidatePath(`/staff/applications/${app.id}`);
}

/** Marks the signed-in person's notifications (and their department's) as read. */
export async function markNotificationsRead() {
  const user = await requireUser();
  await db.update(s.notifications).set({ readAt: new Date() })
    .where(and(isNull(s.notifications.readAt), user.role === "CLIENT" ? eq(s.notifications.userId, user.id) : or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role)))));
  revalidatePath("/staff"); revalidatePath("/portal");
}
