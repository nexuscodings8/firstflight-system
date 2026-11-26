"use server";
// Finance/Admin decisions on refunds, and consultant/admin decisions on amendment requests.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { fromCents, normaliseRef, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";

export type DecState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 1000) => String(fd.get(k) ?? "").trim().slice(0, n);

async function loadRefund(fd: FormData) {
  return db.query.refundRequests.findFirst({ where: eq(s.refundRequests.id, str(fd, "refundId", 64)), with: { application: { columns: { id: true, reference: true, clientId: true } }, invoice: { columns: { number: true } } } });
}
const refresh = (appId: string) => { for (const p of ["/staff/finance/refunds", `/portal/applications/${appId}`, `/staff/applications/${appId}`]) revalidatePath(p); };

/** Step 1 decision: open the refund form for the client, or decline with a reason. */
export async function decideRefund(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r) return { error: "Refund request not found." };
  const approve = fd.get("decision") === "approve";
  const note = str(fd, "note", 500);
  const closable = r.status === "REQUESTED" || (!approve && r.status === "FORM_SUBMITTED");
  if (!closable) return { error: "This request has already been decided." };
  if (!approve && note.length < 5) return { error: "Tell the client why the refund is declined." };
  await db.transaction(async (tx) => {
    await tx.update(s.refundRequests).set({ status: approve ? "FORM_OPEN" : "DECLINED", decisionNote: note || null, decidedById: user.id }).where(eq(s.refundRequests.id, r.id));
    await logActivity(tx, { actorId: user.id, action: approve ? "refund.approved" : "refund.declined", entityType: "refund", entityId: r.id, applicationId: r.application.id, summary: `${user.name} ${approve ? "approved" : "declined"} refund ${r.reference}${note ? `: ${note}` : ""}` });
    await notify(tx, { userId: r.application.clientId, title: approve ? "Refund approved: fill in the form" : "Refund declined", body: approve ? `${r.reference}: tell us how much and how to pay you.` : `${r.reference}: ${note}`, link: `/portal/applications/${r.application.id}` });
  });
  await emailUser(r.application.clientId, approve ? `Refund ${r.reference}: please fill in the refund form` : `Refund ${r.reference} declined`, approve ? `Your refund request ${r.reference} for ${r.invoice?.number ?? r.application.reference} was approved. Open your client portal and fill in the refund form so we can pay you.${note ? `\n\n${note}` : ""}` : `Your refund request ${r.reference} was declined.\n\nReason: ${note}`, `/portal/applications/${r.application.id}`);
  refresh(r.application.id);
  return { ok: approve ? `${r.reference} approved. The client can now fill in the refund form.` : `${r.reference} declined.` };
}

/** Step 2: Finance records that the refund was paid. */
export async function payRefund(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r) return { error: "Refund request not found." };
  if (r.status !== "FORM_SUBMITTED") return { error: "The client hasn't submitted the refund form yet." };
  const cents = parseAmount(str(fd, "amount", 30));
  const reference = normaliseRef(str(fd, "reference", 80));
  const raw = str(fd, "paidAt", 10);
  const paidAt = raw ? new Date(`${raw}T12:00:00+02:00`) : new Date();
  if (cents === null) return { error: "Enter the amount refunded." };
  if (cents > Math.round(Number(r.amountRequested) * 100)) return { error: `That is more than the ${money(r.amountRequested, r.currency ?? "USD")} the client asked for.` };
  if (reference.length < 3) return { error: "Enter the transfer or mobile money reference." };
  if (Number.isNaN(paidAt.getTime()) || +paidAt > Date.now() + 86_400_000) return { error: "Enter a valid date (not in the future)." };
  await db.transaction(async (tx) => {
    await tx.update(s.refundRequests).set({ status: "PAID", paidAmount: fromCents(cents), paidReference: reference, paidAt, processedById: user.id }).where(eq(s.refundRequests.id, r.id));
    await logActivity(tx, { actorId: user.id, action: "refund.paid", entityType: "refund", entityId: r.id, applicationId: r.application.id, summary: `${user.name} paid refund ${r.reference}: ${money(fromCents(cents), r.currency ?? "USD")} (${reference})` });
    await notify(tx, { userId: r.application.clientId, title: "Refund paid", body: `${r.reference}: ${money(fromCents(cents), r.currency ?? "USD")}, reference ${reference}.`, link: `/portal/applications/${r.application.id}` });
  });
  await emailUser(r.application.clientId, `Refund ${r.reference} paid`, `We have paid your refund of ${money(fromCents(cents), r.currency ?? "USD")} (reference ${reference}).`, `/portal/applications/${r.application.id}`);
  refresh(r.application.id);
  return { ok: `${r.reference} marked as paid.` };
}

/** The consultant on the case (or an admin) approves or declines a change request. */
export async function decideAmendment(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const a = await db.query.amendmentRequests.findFirst({ where: eq(s.amendmentRequests.id, str(fd, "amendmentId", 64)), with: { application: true } });
  if (!a || !canWorkOnCase(user, a.application)) return { error: "You can't decide this request." };
  if (a.status !== "REQUESTED") return { error: "This request has already been decided." };
  const approve = fd.get("decision") === "approve";
  const note = str(fd, "note", 1000);
  if (note.length < 5) return { error: approve ? "Tell the client what will happen next." : "Tell the client why." };
  await db.transaction(async (tx) => {
    await tx.update(s.amendmentRequests).set({ status: approve ? "APPROVED" : "DECLINED", decisionNote: note, decidedById: user.id, decidedAt: new Date() }).where(eq(s.amendmentRequests.id, a.id));
    await tx.insert(s.applicationUpdates).values({ applicationId: a.applicationId, authorId: user.id, body: `Your change request was ${approve ? "approved" : "declined"}. ${note}`, visibility: "CLIENT" });
    await logActivity(tx, { actorId: user.id, action: approve ? "amendment.approved" : "amendment.declined", entityType: "amendment", entityId: a.id, applicationId: a.applicationId, summary: `${user.name} ${approve ? "approved" : "declined"} a change request on ${a.application.reference}` });
    await notify(tx, { userId: a.clientId, title: approve ? "Change approved" : "Change declined", body: `${a.application.reference}: ${note.slice(0, 140)}`, link: `/portal/applications/${a.applicationId}` });
  });
  await emailUser(a.clientId, `Your change request on ${a.application.reference}`, `Your change request was ${approve ? "approved" : "declined"}.\n\n${note}`, `/portal/applications/${a.applicationId}`);
  for (const p of [`/staff/applications/${a.applicationId}`, `/portal/applications/${a.applicationId}`]) revalidatePath(p);
  return { ok: `Request ${approve ? "approved" : "declined"}; the client has been told.` };
}
