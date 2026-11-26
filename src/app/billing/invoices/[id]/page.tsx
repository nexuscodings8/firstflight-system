import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canViewInvoice, isStaff } from "@/lib/permissions";
import { PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { SERVICE_LABEL, date, label, money } from "@/lib/format";
import { BillingDoc } from "@/components/billing-doc";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(undefined, `/billing/invoices/${id}`);
  const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, id), with: { payments: { orderBy: [asc(s.payments.paidAt)] }, application: { with: { client: { columns: { name: true, email: true, phone: true } } } } } });
  if (!inv || !canViewInvoice(user, inv.application)) notFound();
  const b = balanceOf(inv);
  const sel = inv.application.selection as { title: string };
  const back = isStaff(user.role) ? `/staff/applications/${inv.applicationId}` : `/portal/applications/${inv.applicationId}`;
  return (
    <BillingDoc title="INVOICE" number={inv.number} back={back}>
      {inv.status === "VOID" && <p className="mt-5 rounded-xl bg-red-50 p-3 text-center font-bold text-red-700">VOID: this invoice was cancelled and does not need to be paid.</p>}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase muted">Billed to</p><p className="font-semibold">{inv.application.client.name}</p><p className="text-sm">{inv.application.client.email}</p>{inv.application.client.phone && <p className="text-sm">{inv.application.client.phone}</p>}</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:text-right">
          <dt className="muted">Issued</dt><dd>{date(inv.createdAt)}</dd>
          <dt className="muted">Due</dt><dd>{date(inv.dueDate)}</dd>
          <dt className="muted">Application</dt><dd>{inv.application.reference}</dd>
          <dt className="muted">Status</dt><dd className="font-semibold">{inv.status === "PARTIALLY_PAID" ? "Part paid" : label(inv.status)}</dd>
        </dl>
      </div>
      <table className="mt-8 w-full text-left text-sm">
        <thead><tr className="border-b-2 border-ink"><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody><tr className="border-b border-line"><td className="py-3"><p className="font-semibold">{inv.description}</p><p className="text-xs muted">{SERVICE_LABEL[inv.application.service]}: {sel.title}</p></td><td className="py-3 text-right font-semibold">{money(inv.amount, inv.currency)}</td></tr></tbody>
      </table>
      {inv.payments.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead><tr className="border-b border-line text-xs muted"><th className="py-1">Payment received</th><th>Method</th><th>Reference</th><th>Receipt</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{inv.payments.map((p) => <tr key={p.id} className="border-b border-line"><td className="py-2">{date(p.paidAt)}</td><td>{PAYMENT_METHOD_LABEL[p.method]}</td><td>{p.reference}</td><td>{p.receiptNumber}</td><td className="text-right">{money(p.amount, inv.currency)}</td></tr>)}</tbody>
        </table>
      )}
      <dl className="ml-auto mt-6 grid max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt>Total</dt><dd className="text-right">{money(inv.amount, inv.currency)}</dd>
        <dt>Paid</dt><dd className="text-right">{money(fromCents(b.paid), inv.currency)}</dd>
        <dt className="border-t border-ink pt-1 font-bold">Balance due</dt><dd className="border-t border-ink pt-1 text-right font-bold">{money(fromCents(b.due), inv.currency)}</dd>
      </dl>
      <p className="mt-8 text-xs muted">Please quote {inv.number} when paying. For questions about this invoice contact FIRST FLIGHT on {COMPANY.phones[0]} or {COMPANY.email}.</p>
    </BillingDoc>
  );
}
