"use server";
// A client reports a payment they made (bank, mobile money, cash at the office, or a loan), with proof.
// Nothing counts as paid until Finance approves it.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { balanceOf, fromCents, normaliseRef, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";
import { isErr, storeUpload } from "@/lib/upload";

export type PayState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 300) => String(fd.get(k) ?? "").trim().slice(0, n);
const METHODS = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD"] as const;

export async function submitPayment(_: PayState, fd: FormData): Promise<PayState> {
  const user = await requireUser(["CLIENT"]);
  const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, str(fd, "invoiceId", 64)), with: { payments: true, application: true } });
  if (!inv || inv.application.clientId !== user.id) return { error: "Invoice not found." };
  if (inv.status === "VOID" || inv.status === "PAID") return { error: inv.status === "PAID" ? "This invoice is already paid." : "This invoice was cancelled." };
  const cents = parseAmount(str(fd, "amount", 30));
  const method = str(fd, "method", 20) as (typeof METHODS)[number];
  const reference = normaliseRef(str(fd, "reference", 80));
  const raw = str(fd, "paidAt", 10);
  const paidAt = new Date(`${raw}T12:00:00+02:00`);
  // Loan-based payment is a separate request, allowed only on the third instalment of a three-instalment schedule.
  if (fd.get("loanFunded")) return { error: "To pay with a loan, use Request loan-based payment on your third instalment, if it's eligible." };
  const loan = false;
  const loanProvider = "";
  if (cents === null) return { error: "Enter the amount you paid." };
  if (!METHODS.includes(method)) return { error: "Choose how you paid." };
  if (reference.length < 3) return { error: "Enter the transaction reference from your bank or mobile money message, or the office cash receipt number." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(+paidAt) || +paidAt > Date.now() + 86_400_000) return { error: "Enter the date you paid (not in the future)." };
  const pending = await db.select({ amount: s.paymentSubmissions.amount }).from(s.paymentSubmissions).where(and(eq(s.paymentSubmissions.invoiceId, inv.id), eq(s.paymentSubmissions.status, "PENDING")));
  const due = balanceOf(inv).due - pending.reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0);
  if (cents > due) return { error: due <= 0 ? "Payments covering this invoice are already waiting for Finance." : `That is more than the ${money(fromCents(due), inv.currency)} still due.` };
  const [dupPay] = await db.select({ id: s.payments.id }).from(s.payments).where(eq(s.payments.reference, reference)).limit(1);
  const [dupSub] = await db.select({ id: s.paymentSubmissions.id }).from(s.paymentSubmissions).where(and(eq(s.paymentSubmissions.reference, reference), eq(s.paymentSubmissions.status, "PENDING"))).limit(1);
  if (dupPay || dupSub) return { error: "This reference has already been submitted. If you paid twice, contact Finance." };
  const proof = await storeUpload(fd.get("proof"), { required: method !== "CASH" && !loan, label: "proof of payment (screenshot, bank slip or receipt)", imagesAndPdfOnly: true });
  if (isErr(proof)) return { error: proof.error };
  const loanDoc = loan ? await storeUpload(fd.get("loanDoc"), { required: true, label: "the loan approval document" }) : null;
  if (isErr(loanDoc)) return { error: loanDoc.error };
  await db.transaction(async (tx) => {
    const [x] = await tx.insert(s.paymentSubmissions).values({
      invoiceId: inv.id, applicationId: inv.applicationId, submittedById: user.id, amount: fromCents(cents), method, reference, paidAt,
      proofKey: proof?.key, proofName: proof?.name, proofMime: proof?.mime, loanFunded: loan, loanProvider: loan ? loanProvider : null,
      loanDocKey: loanDoc?.key, loanDocName: loanDoc?.name, clientNote: str(fd, "note", 500) || null,
    }).returning();
    await logActivity(tx, { actorId: user.id, action: "payment.submitted", entityType: "payment_submission", entityId: x.id, applicationId: inv.applicationId, summary: `${user.name} submitted a ${loan ? "loan-funded " : ""}payment of ${money(x.amount, inv.currency)} for ${inv.number} (${reference})` });
    await notify(tx, { role: "FINANCE", title: "Payment to verify", body: `${inv.application.reference}: ${money(x.amount, inv.currency)} for ${inv.number}${loan ? " (loan)" : ""}.`, link: "/staff/finance/verify" });
  });
  revalidatePath(`/portal/applications/${inv.applicationId}`); revalidatePath("/portal/payments");
  return { ok: "Payment submitted. Finance will check it and send your receipt. It counts as paid once approved." };
}
