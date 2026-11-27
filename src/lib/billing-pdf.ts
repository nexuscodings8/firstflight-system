import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "./finance";
import { SERVICE_LABEL, date, label, money } from "./format";
import { Pdf } from "./pdf";

export const loadInvoice = (id: string) => db.query.invoices.findFirst({ where: eq(s.invoices.id, id), with: { payments: { orderBy: [asc(s.payments.paidAt)] }, application: { with: { client: { columns: { name: true, email: true, phone: true } } } } } });
export const loadPayment = (id: string) => db.query.payments.findFirst({ where: eq(s.payments.id, id), with: { recordedBy: { columns: { name: true } }, invoice: { with: { payments: true, application: { with: { client: { columns: { name: true, email: true, phone: true } } } } } } } });

export async function invoicePdf(inv: NonNullable<Awaited<ReturnType<typeof loadInvoice>>>) {
  const p = await Pdf.create("INVOICE", inv.number);
  const b = balanceOf(inv);
  const sel = inv.application.selection as { title: string };
  if (inv.status === "VOID") await p.text("VOID: this invoice was cancelled and does not need to be paid.", { bold: true, size: 12 });
  await p.pairs([["Billed to", inv.application.client.name], ["Issued", date(inv.createdAt)], ["Email", inv.application.client.email], ["Due", date(inv.dueDate)], ["Phone", inv.application.client.phone ?? "-"], ["Application", inv.application.reference], ["Service", `${SERVICE_LABEL[inv.application.service]}: ${sel.title}`], ["Status", inv.status === "PARTIALLY_PAID" ? "Part paid" : label(inv.status)]]);
  await p.table(["Description", "Amount"], [[inv.description, money(inv.amount, inv.currency)]], [0.75, 0.25]);
  if (inv.payments.length) await p.table(["Payment received", "Method", "Reference", "Receipt", "Amount"], inv.payments.map((x) => [date(x.paidAt), PAYMENT_METHOD_LABEL[x.method], x.reference, x.receiptNumber, money(x.amount, inv.currency)]), [0.18, 0.18, 0.26, 0.2, 0.18]);
  await p.table(["", "Amount"], [["Total", money(inv.amount, inv.currency)], ["Paid", money(fromCents(b.paid), inv.currency)], ["Balance due", money(fromCents(b.due), inv.currency)]], [0.75, 0.25]);
  await p.text(`Please quote ${inv.number} when paying.`, { color: "muted", size: 9 });
  return p.bytes();
}

export async function receiptPdf(pay: NonNullable<Awaited<ReturnType<typeof loadPayment>>>) {
  const p = await Pdf.create("RECEIPT", pay.receiptNumber);
  const inv = pay.invoice;
  const upTo = inv.payments.filter((x) => +x.paidAt < +pay.paidAt || (+x.paidAt === +pay.paidAt && x.receiptNumber <= pay.receiptNumber));
  const after = balanceOf({ ...inv, status: "ISSUED", payments: upTo });
  await p.text(`Received from ${inv.application.client.name} (${inv.application.client.email}) the sum of:`);
  await p.text(money(pay.amount, inv.currency), { size: 24, bold: true, color: "brand", gap: 12 });
  await p.pairs([["For invoice", `${inv.number}: ${inv.description}`], ["Application", inv.application.reference], ["Date paid", date(pay.paidAt)], ["Method", `${PAYMENT_METHOD_LABEL[pay.method]}${pay.loanFunded ? ` (loan: ${pay.loanProvider})` : ""}`], ["Payment reference", pay.reference], ["Approved by", `${pay.recordedBy.name}, FIRST FLIGHT`], ["Invoice total", money(inv.amount, inv.currency)], ["Balance after this payment", money(fromCents(after.due), inv.currency)]]);
  await p.text("Thank you for your payment. Keep this receipt for your records.", { color: "muted", size: 9 });
  return p.bytes();
}
