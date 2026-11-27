import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { logActivity, notify } from "./activity";
import { nextRef } from "./refs";
import { PAYMENT_METHOD_LABEL, fromCents, statusAfterPayments } from "./finance";
import { money } from "./format";
import { autoAdvance } from "./progress";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Method = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CARD";

/**
 * Finance approves money against an invoice: one locked transaction that blocks overpayment and duplicate
 * references, issues the receipt, updates the invoice, notifies, and moves the application on if it was waiting.
 */
export async function approvePaymentTx(tx: Tx, p: {
  invoiceId: string; cents: number; method: Method; reference: string; paidAt: Date; note?: string | null;
  loanFunded?: boolean; loanProvider?: string | null; actor: { id: string; name: string };
}) {
  const [inv] = await tx.select().from(s.invoices).where(eq(s.invoices.id, p.invoiceId)).for("update");
  if (!inv || inv.status === "VOID") throw Object.assign(new Error("void"), { code: "VOID" });
  const [app] = await tx.select().from(s.applications).where(eq(s.applications.id, inv.applicationId));
  const already = await tx.select({ amount: s.payments.amount }).from(s.payments).where(eq(s.payments.invoiceId, inv.id));
  const before = already.reduce((n, x) => n + Math.round(Number(x.amount) * 100), 0);
  if (before + p.cents > Math.round(Number(inv.amount) * 100)) throw Object.assign(new Error("overpay"), { code: "OVERPAY" });
  const [dupe] = await tx.select({ id: s.payments.id }).from(s.payments).where(eq(s.payments.reference, p.reference)).limit(1);
  if (dupe) throw Object.assign(new Error("dupe"), { code: "23505" });
  const receiptNumber = await nextRef(tx, "RC");
  const [row] = await tx.insert(s.payments).values({ invoiceId: inv.id, amount: fromCents(p.cents), method: p.method, reference: p.reference, receiptNumber, paidAt: p.paidAt, note: p.note || null, loanFunded: !!p.loanFunded, loanProvider: p.loanFunded ? p.loanProvider ?? null : null, recordedById: p.actor.id }).returning();
  const status = statusAfterPayments(inv.status, Math.round(Number(inv.amount) * 100), before + p.cents);
  await tx.update(s.invoices).set({ status }).where(eq(s.invoices.id, inv.id));
  await logActivity(tx, { actorId: p.actor.id, action: "payment.approved", entityType: "payment", entityId: row.id, applicationId: inv.applicationId,
    summary: `${p.actor.name} approved ${money(row.amount, inv.currency)} (${PAYMENT_METHOD_LABEL[p.method]}${p.loanFunded ? `, loan: ${p.loanProvider}` : ""}, ${p.reference}) on ${inv.number}; receipt ${receiptNumber}`, changes: { invoiceStatus: [inv.status, status] } });
  await notify(tx, { userId: app.clientId, title: "Payment approved", body: `${money(row.amount, inv.currency)} for ${inv.number}. Receipt ${receiptNumber}.`, link: `/billing/receipts/${row.id}` });
  if (app.consultantId) await notify(tx, { userId: app.consultantId, title: "Client payment approved", body: `${app.reference}: ${inv.number} is now ${status === "PAID" ? "paid in full" : "partly paid"}.`, link: `/staff/applications/${app.id}` });
  await autoAdvance(tx, app.id, p.actor.id);
  return { payment: row, invoice: inv, app };
}

/** Human message for the errors approvePaymentTx throws; null for anything unexpected. */
export function paymentError(e: unknown, reference: string) {
  const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  if (code === "OVERPAY") return "That is more than the balance still due on this invoice. Reload the page and check.";
  if (code === "VOID") return "This invoice is void.";
  if (code === "23505") return `Reference ${reference} has already been recorded. Check you are not entering the same payment twice.`;
  return null;
}

export const lockInvoice = (tx: Tx, id: string) => tx.execute(sql`select id from invoices where id = ${id} for update`);
