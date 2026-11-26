import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canViewInvoice, isStaff } from "@/lib/permissions";
import { PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { BillingDoc } from "@/components/billing-doc";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(undefined, `/billing/receipts/${id}`);
  const pay = await db.query.payments.findFirst({ where: eq(s.payments.id, id), with: { recordedBy: { columns: { name: true } }, invoice: { with: { payments: true, application: { with: { client: { columns: { name: true, email: true } } } } } } } });
  if (!pay || !canViewInvoice(user, pay.invoice.application)) notFound();
  const inv = pay.invoice;
  // Balance as it stood right after this payment, so a reprinted receipt never changes.
  const upTo = inv.payments.filter((p) => +p.paidAt < +pay.paidAt || (+p.paidAt === +pay.paidAt && p.receiptNumber <= pay.receiptNumber));
  const after = balanceOf({ ...inv, status: "ISSUED", payments: upTo });
  const back = isStaff(user.role) ? `/staff/applications/${inv.applicationId}` : `/portal/applications/${inv.applicationId}`;
  return (
    <BillingDoc title="RECEIPT" number={pay.receiptNumber} back={back}>
      <p className="mt-6">Received from <strong>{inv.application.client.name}</strong> ({inv.application.client.email}) the sum of:</p>
      <p className="mt-3 font-display text-4xl font-extrabold text-brand">{money(pay.amount, inv.currency)}</p>
      <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="muted">For invoice</dt><dd className="font-semibold">{inv.number}: {inv.description}</dd></div>
        <div><dt className="muted">Application</dt><dd className="font-semibold">{inv.application.reference}</dd></div>
        <div><dt className="muted">Date paid</dt><dd className="font-semibold">{date(pay.paidAt)}</dd></div>
        <div><dt className="muted">Method</dt><dd className="font-semibold">{PAYMENT_METHOD_LABEL[pay.method]}</dd></div>
        <div><dt className="muted">Payment reference</dt><dd className="font-semibold">{pay.reference}</dd></div>
        <div><dt className="muted">Recorded by</dt><dd className="font-semibold">{pay.recordedBy.name}, FIRST FLIGHT</dd></div>
        <div><dt className="muted">Invoice total</dt><dd className="font-semibold">{money(inv.amount, inv.currency)}</dd></div>
        <div><dt className="muted">Balance remaining after this payment</dt><dd className="font-semibold">{money(fromCents(after.due), inv.currency)}</dd></div>
      </dl>
      {pay.note && <p className="mt-4 text-sm"><span className="muted">Note:</span> {pay.note}</p>}
      <p className="mt-10 text-xs muted">Thank you for your payment. Keep this receipt for your records.</p>
    </BillingDoc>
  );
}
