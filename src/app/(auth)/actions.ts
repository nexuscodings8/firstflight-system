"use server";
import { blocked, clientIp, hit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/permissions";
import { safeNext } from "@/lib/safe-next";
import { logActivity } from "@/lib/activity";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().min(7, "Enter a phone number we can reach you on").max(30),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const raw = Object.fromEntries(["name", "email", "phone", "password"].map((k) => [k, String(fd.get(k) ?? "")]));
  const p = RegisterSchema.safeParse(raw);
  const fields = { name: raw.name, email: raw.email, phone: raw.phone };
  if (!p.success) return { error: p.error.issues[0].message, fields };
  const exists = await db.query.users.findFirst({ where: eq(s.users.email, p.data.email), columns: { id: true } });
  if (exists) return { error: "An account with this email already exists. Sign in instead.", fields };
  const [u] = await db.insert(s.users).values({ name: p.data.name, email: p.data.email, phone: p.data.phone, passwordHash: await bcrypt.hash(p.data.password, 12) }).returning({ id: s.users.id });
  await logActivity(db, { actorId: u.id, action: "user.registered", entityType: "user", entityId: u.id, summary: `${p.data.name} created a client account` });
  await createSession(u.id);
  redirect(safeNext(fd.get("next")) ?? "/portal");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  // Slow down password guessing: 8 wrong attempts per account and address, then a 15-minute pause.
  const key = `login:${await clientIp()}:${email}`;
  if (blocked(key, 8)) return { error: "Too many wrong attempts. Wait 15 minutes, or ask FIRST FLIGHT to reset your password.", fields: { email } };
  const u = email ? await db.query.users.findFirst({ where: eq(s.users.email, email) }) : undefined;
  // Same message whether the email or the password is wrong.
  const ok = u ? await bcrypt.compare(password, u.passwordHash) : await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!u || !ok) { hit(key, 8, 15 * 60_000); return { error: "Email or password is incorrect.", fields: { email } }; }
  if (!u.active) return { error: "This account is deactivated. Contact FIRST FLIGHT.", fields: { email } };
  await createSession(u.id);
  if (u.mustChangePassword) redirect("/account/password?required=1");
  redirect(safeNext(fd.get("next")) ?? homeFor(u.role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
