"use server";
// The refund and reapplication workflow (consultant review → Finance review → admin approval → payout), and
// consultant/admin decisions on client change requests. Each step checks the role and the current state on the server.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { fromCents, normaliseRef, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";
import { createRefundRequest } from "@/lib/refund-create";
import { isErr, storeUpload } from "@/lib/upload";

export type DecState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 1000) => String(fd.get(k) ?? "").trim().slice(0, n);

async function loadRefund(fd: FormData) {
  return db.query.refundRequests.findFirst({ where: eq(s.refundRequests.id, str(fd, "refundId", 64)), with: { application: true, invoice: { columns: { number: true } } } });
}
const refresh = (appId: string) => { for (const p of ["/staff/refunds", "/portal/refunds", `/portal/applications/${appId}`, `/staff/applications/${appId}`]) revalidatePath(p); };
type R = NonNullable<Awaited<ReturnType<typeof loadRefund>>>;
const what = (r: R) => (r.kind === "REAPPLICATION" ? "reapplication" : "refund");

/** Moves a request from one state to the next, inside a transaction that re-checks the state under a row lock. */
async function step(r: R, from: string[], set: Partial<typeof s.refundRequests.$inferInsert>, log: { actorId: string; action: string; summary: string }, after?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>) {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select({ state: s.refundRequests.state }).from(s.refundRequests).where(eq(s.refundRequests.id, r.id)).for("update");
    if (!from.includes(cur.state)) return false;
    await tx.update(s.refundRequests).set(set).where(eq(s.refundRequests.id, r.id));
    await logActivity(tx, { ...log, entityType: "refund", entityId: r.id, applicationId: r.applicationId });
    await after?.(tx);
    return true;
  });
}
const moved = "Someone else has already moved this request on. Refresh the page.";

/** Step 2: the assigned consultant (or an admin) reviews the case and sends it to Finance with a recommendation. */
export async function consultantReview(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r || !canWorkOnCase(user, r.application)) return { error: "You can't review this request." };
  const rec = str(fd, "recommendation", 10);
  const note = str(fd, "note", 1000);
  if (rec !== "support" && rec !== "oppose") return { error: "Say whether you support the request." };
  if (note.length < 5) return { error: "Add a short note for Finance and the administrator." };
  const ok = await step(r, ["SUBMITTED"], { state: "FINANCE_REVIEW", consultantNote: `${rec === "support" ? "Supports" : "Does not support"}: ${note}`, consultantReviewedById: user.id },
    { actorId: user.id, action: "refund.consultant_reviewed", summary: `${user.name} reviewed ${r.reference} (${rec === "support" ? "supports" : "does not support"}) and sent it to Finance` },
    async (tx) => { await notify(tx, { role: "FINANCE", title: `${what(r)[0].toUpperCase() + what(r).slice(1)} request to review`, body: `${r.reference} (${r.application.reference})`, link: "/staff/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); await notify(tx, { userId: r.clientId, title: "Your request moved to Finance review", body: r.reference, link: "/portal/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); });
  if (!ok) return { error: moved };
  refresh(r.applicationId);
  return { ok: `${r.reference} sent to Finance.` };
}

/** Step 3: Finance checks what was paid and how much can be refunded, then sends it to an administrator. */
export async function financeReview(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r) return { error: "Request not found." };
  const note = str(fd, "note", 1000);
  if (note.length < 5) return { error: "Add a note for the administrator (what you checked)." };
  let amountApproved: string | null = null;
  if (r.kind === "REFUND") {
    const cents = parseAmount(str(fd, "amountApproved", 30));
    const paid = Math.round(Number(r.amountPaid ?? r.amountRequested ?? 0) * 100);
    if (cents === null) return { error: "Enter the amount Finance recommends refunding (0 if none)." };
    if (cents > paid) return { error: `That's more than the ${money(fromCents(paid), r.currency ?? "USD")} paid on this invoice.` };
    amountApproved = fromCents(cents);
  }
  const ok = await step(r, ["FINANCE_REVIEW"], { state: "ADMIN_APPROVAL", financeNote: note, amountApproved, financeReviewedById: user.id },
    { actorId: user.id, action: "refund.finance_reviewed", summary: `${user.name} completed the Finance review of ${r.reference}${amountApproved ? ` (recommends ${money(amountApproved, r.currency ?? "USD")})` : ""}` },
    async (tx) => { await notify(tx, { role: "ADMIN", title: "Request waiting for your approval", body: `${r.reference} (${r.application.reference})`, link: "/staff/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); await notify(tx, { userId: r.clientId, title: "Your request is waiting for final approval", body: r.reference, link: "/portal/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); });
  if (!ok) return { error: moved };
  refresh(r.applicationId);
  return { ok: `${r.reference} sent for admin approval.` };
}

/** Step 4: an administrator approves or rejects. A reapplication is carried out straight away. */
export async function adminDecision(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["ADMIN"]);
  const r = await loadRefund(fd);
  if (!r) return { error: "Request not found." };
  const approve = str(fd, "decision", 10) === "approve";
  const note = str(fd, "note", 1000);
  if (note.length < 5) return { error: approve ? "Add a note for the client." : "Tell the client why the request is rejected." };
  const mode = str(fd, "reapplyMode", 10);
  if (approve && r.kind === "REAPPLICATION" && mode !== "CONTINUE" && mode !== "NEW") return { error: "Choose how the client reapplies." };
  if (approve && r.kind === "REAPPLICATION" && mode === "CONTINUE" && r.application.status === "COMPLETED") return { error: "This application is completed: approve a new application instead, so its history stays as it is." };
  if (approve && r.kind === "REFUND" && Number(r.amountApproved ?? 0) <= 0) return { error: "Finance recommended no refund. Reject the request, or send it back to Finance." };
  const state = !approve ? "REJECTED" : r.kind === "REAPPLICATION" ? "COMPLETED" : "APPROVED";
  const ok = await step(r, ["ADMIN_APPROVAL"], { state, status: approve ? (r.kind === "REAPPLICATION" ? "PAID" : "FORM_SUBMITTED") : "DECLINED", adminNote: note, decisionNote: note, adminDecidedById: user.id, decidedById: user.id, reapplyMode: approve && r.kind === "REAPPLICATION" ? mode : null },
    { actorId: user.id, action: approve ? "refund.approved" : "refund.rejected", summary: `${user.name} ${approve ? "approved" : "rejected"} ${what(r)} request ${r.reference}${approve && r.kind === "REAPPLICATION" ? ` (${mode === "CONTINUE" ? "continue the same application" : "start a new application"})` : ""}` },
    async (tx) => {
      if (approve && r.kind === "REAPPLICATION") {
        // A completed application stays completed (its history is kept); the client may then start a new one.
        if (r.application.status !== "COMPLETED") await tx.update(s.applications).set({ status: mode === "CONTINUE" ? "ACTIVE" : "WITHDRAWN" }).where(eq(s.applications.id, r.applicationId));
        await tx.insert(s.applicationUpdates).values({ applicationId: r.applicationId, authorId: user.id, visibility: "CLIENT", body: mode === "CONTINUE" ? `Your reapplication was approved: this application continues. ${note}` : `Your reapplication was approved: this application is closed and you can start a new one. Payments already made stay on record. ${note}` });
      }
      if (approve && r.kind === "REFUND") await notify(tx, { role: "FINANCE", title: "Refund approved: process the payment", body: `${r.reference}: ${money(r.amountApproved, r.currency ?? "USD")}`, link: "/staff/refunds", section: "refunds", applicationId: r.applicationId });
      await notify(tx, { userId: r.clientId, title: approve ? `${what(r)[0].toUpperCase() + what(r).slice(1)} approved` : "Request rejected", body: `${r.reference}: ${note.slice(0, 140)}`, link: "/portal/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId });
    });
  if (!ok) return { error: moved };
  await emailUser(r.clientId, `${r.reference}: ${approve ? "approved" : "rejected"}`, `Your ${what(r)} request ${r.reference} was ${approve ? "approved" : "rejected"}.\n\n${note}${approve && r.kind === "REAPPLICATION" && mode === "NEW" ? "\n\nYou can now start a new application from the website." : ""}`, "/portal/refunds");
  refresh(r.applicationId);
  return { ok: `${r.reference} ${approve ? "approved" : "rejected"}.` };
}

/** Step 5: Finance starts processing an approved refund. */
export async function startRefundPayment(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r || r.kind !== "REFUND") return { error: "Refund not found." };
  const ok = await step(r, ["APPROVED"], { state: "PROCESSING", processedById: user.id },
    { actorId: user.id, action: "refund.processing", summary: `${user.name} started processing refund ${r.reference}` },
    async (tx) => { await notify(tx, { userId: r.clientId, title: "Your refund is being paid", body: r.reference, link: "/portal/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); });
  if (!ok) return { error: moved };
  refresh(r.applicationId);
  return { ok: `${r.reference} is now being processed.` };
}

/** Step 6: Finance records the payout with its real transfer reference. */
export async function completeRefund(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await loadRefund(fd);
  if (!r || r.kind !== "REFUND") return { error: "Refund not found." };
  const cents = parseAmount(str(fd, "amount", 30));
  const reference = normaliseRef(str(fd, "reference", 80));
  const raw = str(fd, "paidAt", 10);
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00+02:00`) : null;
  const method = str(fd, "method", 20);
  if (cents === null || cents <= 0) return { error: "Enter the amount refunded." };
  if (cents > Math.round(Number(r.amountApproved ?? 0) * 100)) return { error: `That is more than the ${money(r.amountApproved, r.currency ?? "USD")} approved.` };
  if (reference.length < 3) return { error: "Enter the transfer or mobile money reference." };
  if (!paidAt || +paidAt > Date.now() + 86_400_000) return { error: "Enter the date paid (not in the future)." };
  if (method !== "BANK_TRANSFER" && method !== "MOBILE_MONEY" && method !== "CASH") return { error: "Choose how the refund was paid." };
  const ok = await step(r, ["PROCESSING"], { state: "COMPLETED", status: "PAID", paidAmount: fromCents(cents), paidReference: reference, paidAt, payoutMethod: method, processedById: user.id },
    { actorId: user.id, action: "refund.paid", summary: `${user.name} paid refund ${r.reference}: ${money(fromCents(cents), r.currency ?? "USD")} (${reference})` },
    async (tx) => { await notify(tx, { userId: r.clientId, title: "Refund paid", body: `${r.reference}: ${money(fromCents(cents), r.currency ?? "USD")}, reference ${reference}.`, link: "/portal/refunds", section: r.kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: r.applicationId }); });
  if (!ok) return { error: "Start processing the refund first, or refresh the page." };
  await emailUser(r.clientId, `Refund ${r.reference} paid`, `We have paid your refund of ${money(fromCents(cents), r.currency ?? "USD")} on ${raw} (reference ${reference}).`, "/portal/refunds");
  refresh(r.applicationId);
  return { ok: `${r.reference} completed.` };
}

/** Staff record a paper refund form the client filled in and signed. */
export async function recordPaperRefund(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["CONSULTANT", "ADMIN", "FINANCE"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || !(user.role === "FINANCE" || canWorkOnCase(user, app))) return { error: "You can't work on this application." };
  if (fd.get("confirm") !== "on") return { error: "Confirm the client signed the paper form." };
  const file = await storeUpload(fd.get("form"), { required: true, label: "the signed refund form", imagesAndPdfOnly: true });
  if (isErr(file) || !file) return { error: isErr(file) ? file.error : "Attach the signed refund form." };
  const res = await createRefundRequest({ appId: app.id, fd, actor: user, source: "PAPER", file });
  refresh(app.id);
  return "ok" in res ? { ok: res.ok.replace(" You can track every step here.", " The client can track it in their portal.") } : res;
}

/** The consultant on the case (or an admin) approves or declines a change request. */
export async function decideAmendment(_: DecState, fd: FormData): Promise<DecState> {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const a = await db.query.amendmentRequests.findFirst({ where: eq(s.amendmentRequests.id, str(fd, "amendmentId", 64)), with: { application: true } });
  if (!a || a.source !== "CLIENT" || !canWorkOnCase(user, a.application)) return { error: "You can't decide this request." };
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
