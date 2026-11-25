import "server-only";
import { redirect } from "next/navigation";
import { readSessionUser } from "./session";
import type { Role } from "./permissions";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const u = await readSessionUser();
  return u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
}

/** Use at the top of protected pages and every server action. */
export async function requireUser(roles?: Role[], next?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (roles && !roles.includes(u.role)) redirect("/forbidden");
  return u;
}
