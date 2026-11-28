import { SectionNotices } from "@/components/section-notices";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps, totals } from "@/lib/client-data";
import { PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { date, label, money } from "@/lib/format";
import { INVOICE_BADGE } from "@/components/invoices-panel";
import { Kpi, KpiRow } from "@/components/shell/app-shell";
import { Empty } from "@/components/cards";

export const metadata = { title: "Payments and balance" };

export default async function Payments() {
  const user = await requireUser(["CLIENT"], "/portal/payments");
  const apps = await clientApps(user.id);
  const t = totals(apps);
  const withInv = apps.filter((a) => a.invoices.length);
  return (
    <div className="grid gap-5">
      <h1 className="text-[clamp(26px,3vw,36px)]">Payments and balance</h1>
      <SectionNotices user={user} sections={["payments"]} path="/portal/payments" limit={5} />
      <KpiRow>
        <Kpi label="Total service cost" value={t.total} icon="tag" />
        <Kpi label="Paid" value={t.paid} icon="wallet" tone={1} />
        <Kpi label="Outstanding" value={t.due} icon="receipt" tone={2} />
      </KpiRow>
      <p className="text-sm muted">Pay by bank transfer, mobile money or at the office, quoting the invoice number. Finance records each payment and your receipt appears here.</p>
      {withInv.map((a) => (
        <section key={a.id} className="card p-5" aria-labelledby={`pa-${a.id}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id={`pa-${a.id}`} className="text-lg"><Link className="text-brand underline" href={`/portal/applications/${a.id}`}>{a.reference}</Link> · {(a.selection as { title: string }).title}</h2></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Due</th><th className="pr-3 text-right">Amount</th><th className="pr-3 text-right">Paid</th><th className="pr-3 text-right">Balance</th><th className="pr-3">Status</th><th>Receipts</th></tr></thead>
              <tbody>{a.invoices.map((i) => { const b = balanceOf(i); return (
                <tr key={i.id} className="border-b border-line align-top last:border-0">
                  <td className="py-2.5 pr-3"><Link className="font-semibold text-brand underline" href={`/billing/invoices/${i.id}`}>{i.number}</Link><p className="text-xs muted">{i.description}</p></td>
                  <td className="pr-3">{date(i.dueDate)}</td>
                  <td className="pr-3 text-right">{money(i.amount, i.currency)}</td>
                  <td className="pr-3 text-right">{money(fromCents(b.paid), i.currency)}</td>
                  <td className="pr-3 text-right font-semibold">{money(fromCents(b.due), i.currency)}</td>
                  <td className="pr-3"><span className={`badge ${INVOICE_BADGE[i.status]}`}>{i.status === "PARTIALLY_PAID" ? "Part paid" : label(i.status)}</span></td>
                  <td>{i.payments.map((p) => <Link key={p.id} className="block text-brand underline" href={`/billing/receipts/${p.id}`}>{p.receiptNumber}<span className="sr-only">: {PAYMENT_METHOD_LABEL[p.method]}</span></Link>)}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        </section>
      ))}
      {!withInv.length && <Empty title="No invoices yet">Finance issues invoices once your application moves to payment.</Empty>}
    </div>
  );
}
