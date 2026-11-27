"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { ALL_SERVICES } from "@/lib/settings";
import { SERVICE_LABEL } from "@/lib/format";

export type PermState = { ok?: string; error?: string } | undefined;

/** Grant or revoke one service for one consultant. Takes effect on the consultant's next request. */
export async function setServiceAccess(_: PermState, fd: FormData): Promise<PermState> {
  const admin = await requireUser(["ADMIN"]);
  const userId = String(fd.get("userId") ?? ""), service = String(fd.get("service") ?? ""), grant = fd.get("grant") === "true";
  if (!(ALL_SERVICES as readonly string[]).includes(service)) return { error: "Unknown service." };
  const k = await db.query.users.findFirst({ where: and(eq(s.users.id, userId), eq(s.users.role, "CONSULTANT")), columns: { id: true, name: true } });
  if (!k) return { error: "Choose a consultant." };
  await db.transaction(async (tx) => {
    if (grant) await tx.insert(s.consultantServices).values({ userId: k.id, service, grantedById: admin.id }).onConflictDoNothing();
    else await tx.delete(s.consultantServices).where(and(eq(s.consultantServices.userId, k.id), eq(s.consultantServices.service, service)));
    await logActivity(tx, { actorId: admin.id, action: grant ? "permission.granted" : "permission.revoked", entityType: "user", entityId: k.id, summary: `${admin.name} ${grant ? "granted" : "revoked"} ${SERVICE_LABEL[service]} access ${grant ? "to" : "from"} ${k.name}`, changes: { [service]: [!grant, grant] } });
    await notify(tx, { userId: k.id, title: grant ? "Service access granted" : "Service access removed", body: `${SERVICE_LABEL[service]}: you ${grant ? "can now" : "can no longer"} handle clients for this service.`, link: "/staff" });
  });
  revalidatePath("/staff/permissions");
  return { ok: `${k.name}: ${SERVICE_LABEL[service]} ${grant ? "granted" : "revoked"}.` };
}
