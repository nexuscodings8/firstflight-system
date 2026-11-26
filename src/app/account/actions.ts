"use server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export type PasswordState = { error?: string; ok?: boolean } | undefined;

export async function changePassword(_: PasswordState, fd: FormData): Promise<PasswordState> {
  const me = await requireUser(undefined, "/account/password", { allowPasswordPending: true });
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("new") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (next.length < 10) return { error: "Use at least 10 characters for the new password." };
  if (next.length > 200) return { error: "That password is too long." };
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (next === current) return { error: "Choose a password different from the current one." };
  const u = await db.query.users.findFirst({ where: eq(s.users.id, me.id), columns: { passwordHash: true } });
  if (!u || !(await bcrypt.compare(current, u.passwordHash))) return { error: "Your current password is incorrect." };
  await db.update(s.users).set({ passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false, updatedAt: new Date() }).where(eq(s.users.id, me.id));
  // Sign out every other device, then keep this one signed in.
  await db.delete(s.sessions).where(eq(s.sessions.userId, me.id));
  await createSession(me.id);
  await logActivity(db, { actorId: me.id, action: "user.password_changed", entityType: "user", entityId: me.id, summary: `${me.name} changed their password` });
  return { ok: true };
}
