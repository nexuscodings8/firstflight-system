"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { sendEmail } from "@/lib/email";

export type EnqState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);

/** Take an enquiry (consultant) or hand it to a consultant (admin). */
export async function assignEnquiry(_: EnqState, fd: FormData): Promise<EnqState> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const enq = await db.query.enquiries.findFirst({ where: eq(s.enquiries.id, str(fd, "enquiryId", 64)) });
  if (!enq) return { error: "Enquiry not found." };
  const to = user.role === "ADMIN" ? str(fd, "assigneeId", 64) || user.id : user.id;
  if (user.role === "CONSULTANT" && enq.assignedToId && enq.assignedToId !== user.id) return { error: "Another consultant is already handling this enquiry." };
  const assignee = await db.query.users.findFirst({ where: and(eq(s.users.id, to), eq(s.users.active, true)), columns: { id: true, name: true, role: true } });
  if (!assignee || (assignee.role !== "CONSULTANT" && assignee.role !== "ADMIN")) return { error: "Choose an active consultant." };
  await db.transaction(async (tx) => {
    await tx.update(s.enquiries).set({ assignedToId: assignee.id, status: enq.status === "NEW" ? "IN_PROGRESS" : enq.status }).where(eq(s.enquiries.id, enq.id));
    await logActivity(tx, { actorId: user.id, action: "enquiry.assigned", entityType: "enquiry", entityId: enq.id, summary: `${user.name} assigned ${enq.reference} to ${assignee.name}` });
    if (assignee.id !== user.id) await notify(tx, { userId: assignee.id, title: "Enquiry assigned to you", body: `${enq.reference} from ${enq.name}`, link: "/staff/enquiries?show=mine" });
  });
  revalidatePath("/staff/enquiries"); revalidatePath("/staff");
  return { ok: `${enq.reference} is now with ${assignee.id === user.id ? "you" : assignee.name}.` };
}

/** Record the answer given and close the enquiry; optionally email that answer to the person who asked. */
export async function closeEnquiry(_: EnqState, fd: FormData): Promise<EnqState> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const enq = await db.query.enquiries.findFirst({ where: eq(s.enquiries.id, str(fd, "enquiryId", 64)) });
  if (!enq) return { error: "Enquiry not found." };
  if (user.role === "CONSULTANT" && enq.assignedToId !== user.id) return { error: "Take this enquiry first." };
  if (enq.status === "CLOSED") return { error: "Already closed." };
  const resolution = str(fd, "resolution", 4000);
  const send = fd.get("sendToClient") === "on";
  if (resolution.length < 5) return { error: "Write the answer you gave, so the next person can see it." };
  await db.transaction(async (tx) => {
    await tx.update(s.enquiries).set({ status: "CLOSED", resolution, assignedToId: enq.assignedToId ?? user.id }).where(eq(s.enquiries.id, enq.id));
    await logActivity(tx, { actorId: user.id, action: "enquiry.closed", entityType: "enquiry", entityId: enq.id, summary: `${user.name} answered and closed ${enq.reference}` });
    if (enq.clientId) await notify(tx, { userId: enq.clientId, title: "Your enquiry was answered", body: `${enq.reference}: ${resolution.slice(0, 140)}`, link: "/portal/enquiries" });
  });
  if (send) await sendEmail(enq.email, `Re: your FIRST FLIGHT enquiry ${enq.reference}`, `Hello ${enq.name},\n\n${resolution}\n\n${user.name}, FIRST FLIGHT`, enq.clientId ? "/portal/enquiries" : undefined);
  revalidatePath("/staff/enquiries"); revalidatePath("/staff");
  return { ok: `${enq.reference} closed.` };
}

export async function reopenEnquiry(_: EnqState, fd: FormData): Promise<EnqState> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const enq = await db.query.enquiries.findFirst({ where: eq(s.enquiries.id, str(fd, "enquiryId", 64)) });
  if (!enq || enq.status !== "CLOSED") return { error: "Only closed enquiries can be reopened." };
  if (user.role === "CONSULTANT" && enq.assignedToId !== user.id) return { error: "Only the consultant who handled it, or an administrator, can reopen it." };
  await db.update(s.enquiries).set({ status: "IN_PROGRESS" }).where(eq(s.enquiries.id, enq.id));
  await logActivity(db, { actorId: user.id, action: "enquiry.reopened", entityType: "enquiry", entityId: enq.id, summary: `${user.name} reopened ${enq.reference}` });
  revalidatePath("/staff/enquiries");
  return { ok: `${enq.reference} reopened.` };
}
