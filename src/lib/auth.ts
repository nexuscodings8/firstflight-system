import "server-only";
import { redirect } from "next/navigation";
import { readSessionUser } from "./session";
import type { Role } from "./permissions";

export type CurrentUser = { id: string; name: string; email: string; role: Role; mustChangePassword: boolean };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const u = await readSessionUser();
  return u ? { id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword } : null;
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
