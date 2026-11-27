import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readSessionUser } from "./session";
import type { Role } from "./permissions";

export type CurrentUser = { id: string; name: string; email: string; role: Role; mustChangePassword: boolean; services?: string[] };

/** The signed-in person. Consultants also carry the services an admin has granted them (checked on every request). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const u = await readSessionUser();
  if (!u) return null;
  const services = u.role === "CONSULTANT"
    ? (await db.select({ service: schema.consultantServices.service }).from(schema.consultantServices).where(eq(schema.consultantServices.userId, u.id))).map((r) => r.service)
    : undefined;
  return { id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword, services };
}

/**
 * Use at the top of protected pages and every server action.
 * Someone signed in with a temporary password is sent to choose their own before anything else.
 */
export async function requireUser(roles?: Role[], next?: string, opts?: { allowPasswordPending?: boolean }): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (u.mustChangePassword && !opts?.allowPasswordPending) redirect("/account/password?required=1");
  if (roles && !roles.includes(u.role)) redirect("/forbidden");
  return u;
}
