"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { approvePaymentTx, paymentError } from "@/lib/payments";
import { money } from "@/lib/format";

export type VerState = { ok?: string; error?: string } | undefined;

/** Finance approves (payment recorded, receipt issued) or rejects a client's payment submission. */
export async function reviewSubmission(_: VerState, fd: FormData): Promise<VerState> {
  const me = await requireUser(["FINANCE", "ADMIN"]);
  const x = await db.query.paymentSubmissions.findFirst({ where: eq(s.paymentSubmissions.id, String(fd.get("id") ?? "")), with: { invoice: true, application: true } });
  if (!x || x.status !== "PENDING") return { error: "This payment was already reviewed." };
  const approve = fd.get("decision") === "approve";
  const internal = String(fd.get("internalNote") ?? "").trim().slice(0, 1000) || null;
  if (approve) {
    if (x.loanFunded && fd.get("loanValidated") !== "on") return { error: "This payment is loan-funded. Confirm you validated the loan arrangement before approving." };
    try {
      const r = await db.transaction(async (tx) => {
        const res = await approvePaymentTx(tx, { invoiceId: x.invoiceId, cents: Math.round(Number(x.amount) * 100), method: x.method, reference: x.reference, paidAt: x.paidAt, note: x.clientNote, loanFunded: x.loanFunded, loanProvider: x.loanProvider, actor: me });
        await tx.update(s.paymentSubmissions).set({ status: "APPROVED", reviewedById: me.id, reviewedAt: new Date(), internalNote: internal, paymentId: res.payment.id }).where(eq(s.paymentSubmissions.id, x.id));
        return res;
      });
      await emailUser(x.application.clientId, `Payment approved: receipt ${r.payment.receiptNumber}`, `Finance approved your payment of ${money(r.payment.amount, x.invoice.currency)} for ${x.invoice.number}. Receipt: ${r.payment.receiptNumber}.`, `/billing/receipts/${r.payment.id}`);
    } catch (e) {
      const msg = paymentError(e, x.reference);
      if (msg) return { error: msg };
      throw e;
    }
  } else {
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
    if (reason.length < 5) return { error: "Tell the client why the payment was not accepted." };
    await db.transaction(async (tx) => {
      await tx.update(s.paymentSubmissions).set({ status: "REJECTED", rejectionReason: reason, internalNote: internal, reviewedById: me.id, reviewedAt: new Date() }).where(eq(s.paymentSubmissions.id, x.id));
      await logActivity(tx, { actorId: me.id, action: "payment.rejected", entityType: "payment_submission", entityId: x.id, applicationId: x.applicationId, summary: `${me.name} rejected a payment submission for ${x.invoice.number} (${x.reference}): ${reason}` });
      await notify(tx, { userId: x.application.clientId, title: "Payment not accepted", body: `${x.invoice.number}: ${reason}`, link: `/portal/applications/${x.applicationId}` });
      if (x.application.consultantId) await notify(tx, { userId: x.application.consultantId, title: "Client payment not accepted", body: `${x.application.reference}: Finance could not accept a payment. The stage stays locked.`, link: `/staff/applications/${x.applicationId}` });
    });
    await emailUser(x.application.clientId, `Payment for ${x.invoice.number} not accepted`, `Finance could not accept the payment you submitted (${x.reference}).\n\nReason: ${reason}`, `/portal/applications/${x.applicationId}`);
  }
  for (const p of ["/staff/finance/verify", `/staff/applications/${x.applicationId}`, `/portal/applications/${x.applicationId}`]) revalidatePath(p);
  return { ok: approve ? "Payment approved; receipt issued." : "Payment rejected; the client has been told why." };
}
