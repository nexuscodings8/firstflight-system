"use server";
// Administrator user management. Temporary passwords are shown once to the admin and must be changed at first sign-in.
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { label } from "@/lib/format";
import type { Role } from "@/lib/permissions";

export type UserState = { ok?: string; error?: string; tempPassword?: string; forEmail?: string } | undefined;
const STAFF: Role[] = ["CONSULTANT", "FINANCE", "CONTENT_MANAGER", "ADMIN"];
const ALL: Role[] = [...STAFF, "CLIENT"];

/** Readable temporary password without look-alike characters, e.g. "Kigali-7m4q-9tzr". */
function tempPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = (n: number) => Array.from({ length: n }, () => a[randomInt(a.length)]).join("");
  return `Ff-${pick(4)}-${pick(4)}-${pick(4)}`;
}

const NewStaff = z.object({
  name: z.string().trim().min(2, "Enter the person's full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["CONSULTANT", "FINANCE", "CONTENT_MANAGER", "ADMIN"], { message: "Choose a role" }),
});

export async function createStaff(_: UserState, fd: FormData): Promise<UserState> {
  const admin = await requireUser(["ADMIN"]);
  const p = NewStaff.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: String(fd.get("phone") ?? "") || undefined, role: fd.get("role") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (await db.query.users.findFirst({ where: eq(s.users.email, p.data.email), columns: { id: true } })) return { error: "An account with this email already exists. Change its role or reset its password below instead." };
  const pw = tempPassword();
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(s.users).values({ name: p.data.name, email: p.data.email, phone: p.data.phone ?? null, role: p.data.role, passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true }).returning({ id: s.users.id });
    await logActivity(tx, { actorId: admin.id, action: "user.created", entityType: "user", entityId: u.id, summary: `${admin.name} created a ${label(p.data.role)} account for ${p.data.name} (${p.data.email})` });
  });
  await sendEmail(p.data.email, "Your FIRST FLIGHT staff account", `Hello ${p.data.name},\n\nAn account has been created for you as ${label(p.data.role)}. Sign in with this email address; your administrator will give you a temporary password, and you will choose your own at first sign-in.`, "/login");
  revalidatePath("/staff/users");
  return { ok: `Account created for ${p.data.name}.`, tempPassword: pw, forEmail: p.data.email };
}

async function target(admin: { id: string }, fd: FormData) {
  const id = String(fd.get("userId") ?? "");
  if (id === admin.id) return { error: "You can't change your own account here. Ask another administrator." } as const;
  const u = await db.query.users.findFirst({ where: eq(s.users.id, id) });
  return u ? ({ u } as const) : ({ error: "User not found." } as const);
}

/** An admin must always remain: refuses to remove the last active administrator. */
async function wouldRemoveLastAdmin(userId: string) {
  const others = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.role, "ADMIN"), eq(s.users.active, true), ne(s.users.id, userId))).limit(1);
  return others.length === 0;
}

export async function resetPassword(_: UserState, fd: FormData): Promise<UserState> {
  const admin = await requireUser(["ADMIN"]);
  const t = await target(admin, fd);
  if ("error" in t) return { error: t.error };
  const pw = tempPassword();
  await db.transaction(async (tx) => {
    await tx.update(s.users).set({ passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true }).where(eq(s.users.id, t.u.id));
    await tx.delete(s.sessions).where(eq(s.sessions.userId, t.u.id)); // sign them out everywhere
    await logActivity(tx, { actorId: admin.id, action: "user.password_reset", entityType: "user", entityId: t.u.id, summary: `${admin.name} reset the password for ${t.u.name}` });
  });
  revalidatePath("/staff/users");
  return { ok: `Password reset for ${t.u.name}. They have been signed out.`, tempPassword: pw, forEmail: t.u.email };
}

export async function setActive(_: UserState, fd: FormData): Promise<UserState> {
  const admin = await requireUser(["ADMIN"]);
  const t = await target(admin, fd);
  if ("error" in t) return { error: t.error };
  const active = fd.get("active") === "true";
  if (!active && t.u.role === "ADMIN" && (await wouldRemoveLastAdmin(t.u.id))) return { error: "This is the only active administrator, so it can't be deactivated." };
  const open = !active && t.u.role === "CONSULTANT" ? await db.query.applications.findFirst({ where: and(eq(s.applications.consultantId, t.u.id), eq(s.applications.status, "ACTIVE")), columns: { reference: true } }) : null;
  if (open) return { error: `${t.u.name} still has active applications (e.g. ${open.reference}). Reassign them from the dashboard first.` };
  await db.transaction(async (tx) => {
    await tx.update(s.users).set({ active }).where(eq(s.users.id, t.u.id));
    if (!active) await tx.delete(s.sessions).where(eq(s.sessions.userId, t.u.id));
    await logActivity(tx, { actorId: admin.id, action: active ? "user.reactivated" : "user.deactivated", entityType: "user", entityId: t.u.id, summary: `${admin.name} ${active ? "reactivated" : "deactivated"} ${t.u.name}` });
  });
  revalidatePath("/staff/users");
  return { ok: `${t.u.name} ${active ? "can sign in again" : "can no longer sign in"}.` };
}

export async function changeRole(_: UserState, fd: FormData): Promise<UserState> {
  const admin = await requireUser(["ADMIN"]);
  const t = await target(admin, fd);
  if ("error" in t) return { error: t.error };
  const role = String(fd.get("role") ?? "") as Role;
  if (!ALL.includes(role)) return { error: "Choose a role." };
  if (role === t.u.role) return { error: "That is already their role." };
  if (t.u.role === "ADMIN" && (await wouldRemoveLastAdmin(t.u.id))) return { error: "This is the only active administrator." };
  if (t.u.role === "CONSULTANT") {
    const open = await db.query.applications.findFirst({ where: and(eq(s.applications.consultantId, t.u.id), eq(s.applications.status, "ACTIVE")), columns: { reference: true } });
    if (open) return { error: `Reassign ${t.u.name}'s active applications (e.g. ${open.reference}) before changing their role.` };
  }
  await db.transaction(async (tx) => {
    await tx.update(s.users).set({ role }).where(eq(s.users.id, t.u.id));
    await tx.delete(s.sessions).where(eq(s.sessions.userId, t.u.id)); // new permissions apply from their next sign-in
    await logActivity(tx, { actorId: admin.id, action: "user.role_changed", entityType: "user", entityId: t.u.id, summary: `${admin.name} changed ${t.u.name} from ${label(t.u.role)} to ${label(role)}`, changes: { role: [t.u.role, role] } });
  });
  revalidatePath("/staff/users");
  return { ok: `${t.u.name} is now ${label(role)}. They need to sign in again.` };
}
