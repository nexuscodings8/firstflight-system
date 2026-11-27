"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { createSession } from "@/lib/session";
import { findActivation } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";

export type ActState = { error?: string } | undefined;

export async function activateAccount(_: ActState, fd: FormData): Promise<ActState> {
  const t = await findActivation(String(fd.get("token") ?? ""));
  if (!t) return { error: "This activation link has expired or was already used. Ask your consultant for a new one." };
  const pw = String(fd.get("password") ?? ""), again = String(fd.get("confirm") ?? "");
  if (pw.length < 10) return { error: "Choose a password of at least 10 characters." };
  if (pw !== again) return { error: "The two passwords don't match." };
  await db.transaction(async (tx) => {
    await tx.update(s.users).set({ passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: false, active: true }).where(eq(s.users.id, t.userId));
    await tx.update(s.accountTokens).set({ usedAt: new Date() }).where(eq(s.accountTokens.id, t.id));
    await logActivity(tx, { actorId: t.userId, action: "client.activated", entityType: "user", entityId: t.userId, summary: "Client activated their account and set a password" });
  });
  await createSession(t.userId);
  redirect("/portal?activated=1");
}
