"use server";
// Consultants (and admins) register clients met at the office. The client sets their own password from an
// activation link; staff never see or set it. The new application follows the normal assignment rules.
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { hasService } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { sendEmail, siteUrl } from "@/lib/email";
import { createActivationToken } from "@/lib/tokens";
import { resolveSelection } from "@/lib/selection";
import { createApplication } from "@/lib/create-application";
import { SERVICE_LABEL } from "@/lib/format";

export type ClientState = { ok?: string; error?: string; link?: string; applicationId?: string } | undefined;

const Schema = z.object({
  name: z.string().trim().min(2, "Enter the client's full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().min(8, "Enter the client's phone number with country code").max(30),
  listing: z.string().trim().max(80).optional(),
  nat: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(), res: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  note: z.string().trim().max(2000).optional(),
});
const digits = (p: string) => p.replace(/\D/g, "").replace(/^0+/, "");

export async function createClientAccount(_: ClientState, fd: FormData): Promise<ClientState> {
  const me = await requireUser(["CONSULTANT", "ADMIN"]);
  const p = Schema.safeParse(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]).filter(([, v]) => v !== "")));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (await db.query.users.findFirst({ where: eq(s.users.email, d.email), columns: { id: true } })) return { error: "An account with this email already exists. Search for the client instead of creating a second account." };
  const samePhone = (await db.select({ phone: s.users.phone }).from(s.users).where(eq(s.users.role, "CLIENT"))).some((u) => u.phone && digits(u.phone).endsWith(digits(d.phone).slice(-9)));
  if (samePhone) return { error: "A client with this phone number already exists. Check you are not creating a duplicate account." };
  // Optional first application: "job:ID", "program:ID" or "visa:ID".
  let sel = null;
  if (d.listing) {
    const [kind, id] = d.listing.split(":");
    sel = await resolveSelection(kind === "visa" ? { visa: id, nat: d.nat ?? "RW", res: d.res ?? "RW", dest: (await db.query.visaGuidance.findFirst({ where: eq(s.visaGuidance.id, id), columns: { destinationIso: true } }))?.destinationIso } : { [kind]: id });
    if (!sel) return { error: "That listing is no longer published." };
    if (!hasService(me, sel.service)) return { error: `You're not authorised for ${SERVICE_LABEL[sel.service]}.` };
  }
  const client = await db.transaction(async (tx) => {
    const [u] = await tx.insert(s.users).values({ name: d.name, email: d.email, phone: d.phone, role: "CLIENT", passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 12) }).returning({ id: s.users.id, name: s.users.name });
    await logActivity(tx, { actorId: me.id, action: "client.created", entityType: "user", entityId: u.id, summary: `${me.name} registered client ${d.name} (${d.email})` });
    return u;
  });
  const token = await createActivationToken(client.id, me.id);
  const link = `${siteUrl()}/activate?token=${token}`;
  await sendEmail(d.email, "Activate your FIRST FLIGHT account", `Hello ${d.name},\n\n${me.name} has created your FIRST FLIGHT client account. Open the link below within 7 days to choose your password and follow your application online:\n\n${link}`);
  let applicationId: string | undefined;
  if (sel) {
    const r = await createApplication({ client, sel, note: d.note ?? null, actor: me, via: "staff" });
    applicationId = r.created?.id;
    // Consultants don't get the client automatically: their request goes to an administrator.
    if (applicationId && me.role === "CONSULTANT") {
      await db.transaction(async (tx) => {
        const [r2] = await tx.insert(s.assignmentRequests).values({ applicationId: applicationId!, consultantId: me.id, note: "Registered this client at the office" }).returning();
        await logActivity(tx, { actorId: me.id, action: "assignment.requested", entityType: "assignment_request", entityId: r2.id, applicationId, summary: `${me.name} asked to serve the client they registered` });
        await notify(tx, { role: "ADMIN", title: "Request to serve a client", body: `${me.name} registered ${d.name} and asked to serve them.`, link: "/staff/assignments" });
      });
    }
  }
  revalidatePath("/staff/available"); revalidatePath("/staff/assignments");
  return {
    ok: `Account created for ${d.name}.${sel ? " Their application is open" + (me.role === "CONSULTANT" ? " and your request to serve them is waiting for an administrator." : ".") : ""}`,
    link, applicationId,
  };
}

export async function resendActivation(_: ClientState, fd: FormData): Promise<ClientState> {
  const me = await requireUser(["CONSULTANT", "ADMIN"]);
  const u = await db.query.users.findFirst({ where: and(eq(s.users.id, String(fd.get("userId") ?? "")), eq(s.users.role, "CLIENT")) });
  if (!u) return { error: "Client not found." };
  const link = `${siteUrl()}/activate?token=${await createActivationToken(u.id, me.id)}`;
  await sendEmail(u.email, "Activate your FIRST FLIGHT account", `Hello ${u.name},\n\nUse this link within 7 days to choose your password:\n\n${link}`);
  return { ok: "A new activation link was created; the old one no longer works.", link };
}
