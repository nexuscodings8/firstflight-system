"use server";
// Loan-based payment of the final instalment. Allowed only on the third and final instalment of a schedule with
// exactly three instalments, when Finance allowed it. A request never counts as payment: only Finance or Admin
// approval records the approved amount against the instalment, with a receipt and a full audit trail.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { balanceOf, fromCents, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";
import type { FeePlan } from "@/lib/fees";
import { nextRef } from "@/lib/refs";
import { loanAllowed } from "@/lib/schedule";
import { isErr, storeUpload } from "@/lib/upload";
import { approvePaymentTx, paymentError } from "@/lib/payments";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);
const NOT_ELIGIBLE = "Loan-based payment is only available for the third and final instalment of a three-instalment schedule, when Finance has allowed it.";

/** Which instalment an invoice is, and whether a loan is allowed on it. Checked on every request. */
async function eligibility(invoiceId: string) {
  const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, invoiceId), with: { payments: true, application: true } });
  if (!inv) return null;
  const plan = inv.application.feePlan as FeePlan | null;
  const index = plan?.installments.findIndex((r) => r.invoiceId === inv.id) ?? -1;
  return { inv, plan, index, allowed: index >= 0 && loanAllowed(plan, index) };
}

export async function requestLoan(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const e = await eligibility(str(fd, "invoiceId", 64));
  if (!e || e.inv.application.clientId !== user.id) return { error: "Invoice not found." };
  if (!e.allowed) return { error: NOT_ELIGIBLE };
  const { inv } = e;
  if (inv.status !== "ISSUED" && inv.status !== "PARTIALLY_PAID") return { error: inv.status === "PAID" ? "This instalment is already paid." : "This invoice isn't payable." };
  const due = balanceOf(inv).due;
  const cents = parseAmount(str(fd, "amount", 30));
  const provider = str(fd, "provider", 120), details = str(fd, "details", 2000);
  if (provider.length < 2) return { error: "Name the bank or lender." };
  if (cents === null || cents <= 0) return { error: "Enter the loan amount." };
  if (cents > due) return { error: `The loan can't be more than the ${money(fromCents(due), inv.currency)} still due on this instalment.` };
  if (details.length < 10) return { error: "Describe the loan (lender, terms, when it pays out)." };
  const doc = await storeUpload(fd.get("doc"), { required: true, label: "the loan approval or offer from the lender", imagesAndPdfOnly: true });
  if (isErr(doc) || !doc) return { error: isErr(doc) ? doc.error : "Attach the loan document." };
  const res = await db.transaction(async (tx) => {
    await tx.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.id, inv.id)).for("update");
    const [open] = await tx.select({ ref: s.loanRequests.reference }).from(s.loanRequests).where(and(eq(s.loanRequests.invoiceId, inv.id), eq(s.loanRequests.status, "PENDING_REVIEW"))).limit(1);
    if (open) return { error: `Loan request ${open.ref} is already waiting for review.` };
    const reference = await nextRef(tx, "LN");
    const [l] = await tx.insert(s.loanRequests).values({ reference, applicationId: inv.applicationId, invoiceId: inv.id, installmentIndex: e.index, clientId: user.id, provider, amountRequested: fromCents(cents), details, docKey: doc.key, docName: doc.name, docMime: doc.mime }).returning({ id: s.loanRequests.id });
    await logActivity(tx, { actorId: user.id, action: "loan.requested", entityType: "loan_request", entityId: l.id, applicationId: inv.applicationId, summary: `${user.name} requested loan-based payment ${reference} for ${inv.number} (instalment 3): ${money(fromCents(cents), inv.currency)} from ${provider}`, changes: { status: [null, "PENDING_REVIEW"] } });
    for (const role of ["FINANCE", "ADMIN"] as const) await notify(tx, { role, title: "Loan request to review", body: `${inv.application.reference}: ${reference}, ${money(fromCents(cents), inv.currency)} from ${provider}.`, link: "/staff/finance/loans" });
    if (inv.application.consultantId) await notify(tx, { userId: inv.application.consultantId, title: "Client requested a loan", body: `${inv.application.reference}: final instalment, pending Finance review.`, link: `/staff/applications/${inv.applicationId}` });
    return { ok: `Loan request ${reference} sent. It's pending review; your instalment is not counted as paid until Finance approves the loan.` };
  });
  for (const p of [`/portal/applications/${inv.applicationId}`, "/staff/finance/loans"]) revalidatePath(p);
  return res;
}

export async function decideLoan(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const l = await db.query.loanRequests.findFirst({ where: eq(s.loanRequests.id, str(fd, "loanId", 64)) });
  if (!l) return { error: "Loan request not found." };
  if (l.status !== "PENDING_REVIEW") return { error: "This request has already been decided." };
  const approve = str(fd, "decision", 10) === "approve";
  const note = str(fd, "note", 1000), internal = str(fd, "internalNote", 1000) || null;
  if (!approve) {
    if (note.length < 5) return { error: "Tell the client why the loan isn't accepted." };
    const ok = await db.transaction(async (tx) => {
      const [cur] = await tx.select({ st: s.loanRequests.status }).from(s.loanRequests).where(eq(s.loanRequests.id, l.id)).for("update");
      if (cur.st !== "PENDING_REVIEW") return false;
      await tx.update(s.loanRequests).set({ status: "REJECTED", decisionNote: note, internalNote: internal, decidedById: user.id, decidedAt: new Date() }).where(eq(s.loanRequests.id, l.id));
      await logActivity(tx, { actorId: user.id, action: "loan.rejected", entityType: "loan_request", entityId: l.id, applicationId: l.applicationId, summary: `${user.name} rejected loan request ${l.reference}: ${note}`, changes: { status: ["PENDING_REVIEW", "REJECTED"] } });
      await notify(tx, { userId: l.clientId, title: "Loan request not accepted", body: `${l.reference}: ${note}. Your final instalment is still payable.`, link: `/portal/applications/${l.applicationId}#invoices` });
      return true;
    });
    if (!ok) return { error: "This request has already been decided." };
    revalidatePath("/staff/finance/loans");
    return { ok: `${l.reference} rejected; the client has been told.` };
  }
  // Re-check eligibility at decision time: the rule is enforced here too, not only when the client asks.
  const e = await eligibility(l.invoiceId);
  if (!e?.allowed) return { error: NOT_ELIGIBLE };
  if (fd.get("verified") !== "on") return { error: "Confirm you verified the loan documents with the lender." };
  const cents = parseAmount(str(fd, "approvedAmount", 30));
  const provider = str(fd, "approvedProvider", 120) || l.provider;
  const conditions = str(fd, "conditions", 1000) || null;
  if (cents === null || cents <= 0) return { error: "Enter the approved loan amount." };
  try {
    const r = await db.transaction(async (tx) => {
      const [cur] = await tx.select({ st: s.loanRequests.status }).from(s.loanRequests).where(eq(s.loanRequests.id, l.id)).for("update");
      if (cur.st !== "PENDING_REVIEW") throw Object.assign(new Error("decided"), { code: "DECIDED" });
      const res = await approvePaymentTx(tx, { invoiceId: l.invoiceId, cents, method: "LOAN", reference: l.reference, paidAt: new Date(), note: conditions, loanFunded: true, loanProvider: provider, actor: user, viaLoanApproval: true });
      await tx.update(s.loanRequests).set({ status: "APPROVED", approvedAmount: fromCents(cents), approvedProvider: provider, conditions, internalNote: internal, decisionNote: note || null, decidedById: user.id, decidedAt: new Date(), paymentId: res.payment.id }).where(eq(s.loanRequests.id, l.id));
      await logActivity(tx, { actorId: user.id, action: "loan.approved", entityType: "loan_request", entityId: l.id, applicationId: l.applicationId, summary: `${user.name} approved loan ${l.reference}: ${money(fromCents(cents), res.invoice.currency)} from ${provider} on ${res.invoice.number}`, changes: { status: ["PENDING_REVIEW", "APPROVED"], amount: [l.amountRequested, fromCents(cents)] } });
      await notify(tx, { userId: l.clientId, title: "Loan approved", body: `${l.reference}: ${money(fromCents(cents), res.invoice.currency)} from ${provider} is recorded against your final instalment.${conditions ? ` Conditions: ${conditions}` : ""}`, link: `/portal/applications/${l.applicationId}#invoices` });
      return res;
    });
    await emailUser(l.clientId, `Loan approved: ${l.reference}`, `Finance approved your loan-based payment: ${money(fromCents(cents), r.invoice.currency)} from ${provider}, recorded against ${r.invoice.number}. Receipt ${r.payment.receiptNumber}.${conditions ? `\n\nConditions: ${conditions}` : ""}`, `/portal/applications/${l.applicationId}`);
  } catch (err) {
    if ((err as { code?: string }).code === "DECIDED") return { error: "This request has already been decided." };
    const msg = paymentError(err, l.reference);
    if (msg) return { error: msg.replace("balance still due", "balance still due; approve a smaller amount") };
    throw err;
  }
  for (const p of ["/staff/finance/loans", `/staff/applications/${l.applicationId}`, `/portal/applications/${l.applicationId}`]) revalidatePath(p);
  return { ok: `${l.reference} approved and recorded against the final instalment.` };
}
