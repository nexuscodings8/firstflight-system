"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { nextRef } from "@/lib/refs";
import { approvePaymentTx, paymentError } from "@/lib/payments";
import { CURRENCIES, balanceOf, fromCents, normaliseRef, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";

export type FinState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);
const METHODS = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD"] as const;

function refresh(appId: string) {
  for (const p of [`/staff/applications/${appId}`, `/portal/applications/${appId}`, "/staff/finance", "/staff"]) revalidatePath(p);
}

/** Finance issues an invoice on an application, for example one per instalment. */
export async function issueInvoice(_: FinState, fd: FormData): Promise<FinState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app) return { error: "Application not found." };
  const description = str(fd, "description", 200);
  const cents = parseAmount(str(fd, "amount", 30));
  const currency = str(fd, "currency", 3) as (typeof CURRENCIES)[number];
  const dueRaw = str(fd, "dueDate", 10);
  const due = dueRaw ? new Date(`${dueRaw}T23:59:00+02:00`) : null;
  if (description.length < 3) return { error: "Describe what the invoice is for, e.g. \"Instalment 1 of 3: processing fee\"." };
  if (cents === null) return { error: "Enter a valid amount, e.g. 450 or 450.50." };
  if (!CURRENCIES.includes(currency)) return { error: "Choose a currency." };
  if (due && Number.isNaN(due.getTime())) return { error: "Enter a valid due date." };
  const inv = await db.transaction(async (tx) => {
    const number = await nextRef(tx, "INV");
    const [row] = await tx.insert(s.invoices).values({ number, applicationId: app.id, description, amount: fromCents(cents), currency, dueDate: due, status: "ISSUED", createdById: user.id }).returning();
    await logActivity(tx, { actorId: user.id, action: "invoice.issued", entityType: "invoice", entityId: row.id, applicationId: app.id, summary: `${user.name} issued ${number} (${money(row.amount, currency)}) on ${app.reference}` });
    await notify(tx, { userId: app.clientId, title: "New invoice", body: `${number}: ${description}, ${money(row.amount, currency)}`, link: `/billing/invoices/${row.id}` });
    return row;
  });
  await emailUser(app.clientId, `Invoice ${inv.number} from FIRST FLIGHT`, `A new invoice has been issued for application ${app.reference}.\n\n${description}\nAmount: ${money(inv.amount, currency)}${due ? `\nDue: ${due.toLocaleDateString("en-GB")}` : ""}`, `/billing/invoices/${inv.id}`);
  refresh(app.id);
  return { ok: `Invoice ${inv.number} issued and sent to the client.` };
}

/** Record a payment against an invoice; issues a receipt number. Duplicate references are refused. */
export async function recordPayment(_: FinState, fd: FormData): Promise<FinState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, str(fd, "invoiceId", 64)), with: { payments: true, application: true } });
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "VOID") return { error: "This invoice is void." };
  const cents = parseAmount(str(fd, "amount", 30));
  const method = str(fd, "method", 20) as (typeof METHODS)[number];
  const reference = normaliseRef(str(fd, "reference", 80));
  const paidRaw = str(fd, "paidAt", 10);
  const paidAt = paidRaw ? new Date(`${paidRaw}T12:00:00+02:00`) : new Date();
  const note = str(fd, "note", 300);
  if (cents === null) return { error: "Enter a valid amount." };
  if (!METHODS.includes(method)) return { error: "Choose how the client paid." };
  if (reference.length < 3) return { error: "Enter the payment reference from the bank, mobile money or cash book." };
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) return { error: "Enter a valid payment date (not in the future)." };
  const { due } = balanceOf(inv);
  if (due === 0) return { error: "This invoice is already fully paid." };
  if (cents > due) return { error: `That is more than the balance of ${money(fromCents(due), inv.currency)}.` };
  const dupe = await db.query.payments.findFirst({ where: eq(s.payments.reference, reference), with: { invoice: { columns: { number: true } } } });
  if (dupe) return { error: `Reference ${reference} was already recorded on ${dupe.invoice.number} (receipt ${dupe.receiptNumber}). Check you are not entering the same payment twice.` };
  // Loans are never recorded here: they go through a loan request on an eligible third instalment.
  if (fd.get("loanFunded")) return { error: "Loan-based payments are approved under Loan requests, only for an eligible third instalment." };
  let pay;
  try {
    pay = (await db.transaction((tx) => approvePaymentTx(tx, { invoiceId: inv.id, cents, method, reference, paidAt, note, actor: user }))).payment;
  } catch (e) {
    const msg = paymentError(e, reference);
    if (msg) return { error: msg };
    throw e;
  }
  await emailUser(inv.application.clientId, `Receipt ${pay.receiptNumber} from FIRST FLIGHT`, `We received your payment of ${money(pay.amount, inv.currency)} for invoice ${inv.number} (${inv.description}). Thank you.\n\nReceipt number: ${pay.receiptNumber}`, `/billing/receipts/${pay.id}`);
  refresh(inv.applicationId);
  return { ok: `Payment recorded. Receipt ${pay.receiptNumber} issued.` };
}

/** Cancel an invoice issued by mistake. Only possible before any payment is recorded on it. */
export async function voidInvoice(_: FinState, fd: FormData): Promise<FinState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, str(fd, "invoiceId", 64)), with: { payments: { columns: { id: true } }, application: { columns: { reference: true, clientId: true } } } });
  const reason = str(fd, "reason", 300);
  if (!inv) return { error: "Invoice not found." };
  if (inv.status === "VOID") return { error: "Already void." };
  if (inv.payments.length) return { error: "This invoice has payments, so it can't be voided." };
  if (reason.length < 5) return { error: "Give a reason for voiding it." };
  await db.transaction(async (tx) => {
    await tx.update(s.invoices).set({ status: "VOID" }).where(eq(s.invoices.id, inv.id));
    await logActivity(tx, { actorId: user.id, action: "invoice.voided", entityType: "invoice", entityId: inv.id, applicationId: inv.applicationId, summary: `${user.name} voided ${inv.number}: ${reason}`, changes: { status: [inv.status, "VOID"] } });
    await notify(tx, { userId: inv.application.clientId, title: "Invoice cancelled", body: `${inv.number} was cancelled and does not need to be paid.`, link: `/billing/invoices/${inv.id}` });
  });
  refresh(inv.applicationId);
  return { ok: `${inv.number} voided.` };
}
