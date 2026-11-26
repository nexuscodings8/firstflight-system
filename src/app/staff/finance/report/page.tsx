import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL, currentMonth, fromCents, toCents } from "@/lib/finance";
import { SERVICE_LABEL, date, money } from "@/lib/format";
import { paymentsForMonth, refundsForMonth } from "@/lib/report";
import { PrintButton } from "@/components/print-button";
import { Empty } from "@/components/cards";

export const metadata = { title: "Monthly payment report" };

const monthName = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const shift = (ym: string, d: number) => { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return t.toISOString().slice(0, 7); };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser(["FINANCE", "ADMIN"], "/staff/finance/report");
  const now = currentMonth();
  const sp = (await searchParams).month;
  const ym = sp && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp) ? sp : now;
  const [rows, refunds] = [(await paymentsForMonth(ym))!, (await refundsForMonth(ym))!];
  const refundTotals = new Map<string, number>();
  for (const r of refunds) refundTotals.set(r.currency ?? "USD", (refundTotals.get(r.currency ?? "USD") ?? 0) + toCents(r.paidAmount ?? 0));
  const totals = new Map<string, number>(), byMethod = new Map<string, number>();
  for (const p of rows) {
    totals.set(p.invoice.currency, (totals.get(p.invoice.currency) ?? 0) + toCents(p.amount));
    const k = `${p.method}|${p.invoice.currency}`; byMethod.set(k, (byMethod.get(k) ?? 0) + toCents(p.amount));
  }
  return (
    <div className="grid gap-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <Link href="/staff/finance" className="text-sm font-semibold text-brand">← Finance</Link>
        <form className="flex flex-wrap items-end gap-2" action="/staff/finance/report">
          <Link className="btn-ghost btn-sm" href={`?month=${shift(ym, -1)}`}>← {monthName(shift(ym, -1))}</Link>
          <div><label className="label" htmlFor="m">Month</label><input id="m" type="month" name="month" defaultValue={ym} className="input min-h-9 py-1" /></div>
          <button className="btn-ghost btn-sm">Show</button>
          {ym < now && <Link className="btn-ghost btn-sm" href={`?month=${shift(ym, 1)}`}>{monthName(shift(ym, 1))} →</Link>}
          <a className="btn-ghost btn-sm" href={`/staff/finance/report/csv?month=${ym}`}>Download CSV</a>
          <PrintButton />
        </form>
      </div>
      <section className="card p-6 print:border-0 print:p-0">
        <p className="eyebrow">FIRST FLIGHT BEST TRAVEL SOLUTION LTD</p>
        <h1 className="text-3xl">Payments received: {monthName(ym)}</h1>
        <p className="text-sm muted">Prepared by {user.name} on {date(new Date())} · {rows.length} payment{rows.length === 1 ? "" : "s"}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[...totals].map(([cur, c]) => <div key={cur} className="rounded-xl bg-mist p-4"><p className="text-sm muted">Total received ({cur})</p><p className="font-display text-2xl font-extrabold">{money(fromCents(c), cur)}</p>{refundTotals.get(cur) ? <p className="mt-1 text-sm">Refunded {money(fromCents(refundTotals.get(cur)!), cur)} · net {money(fromCents(c - refundTotals.get(cur)!), cur)}</p> : null}</div>)}
          {[...refundTotals].filter(([cur]) => !totals.has(cur)).map(([cur, c]) => <div key={`r-${cur}`} className="rounded-xl bg-mist p-4"><p className="text-sm muted">Refunded ({cur})</p><p className="font-display text-2xl font-extrabold">{money(fromCents(c), cur)}</p></div>)}
        </div>
        {byMethod.size > 0 && <><h2 className="mt-6 text-lg">By payment method</h2><table className="mt-2 w-full max-w-md text-sm"><tbody>{[...byMethod].map(([k, c]) => { const [m, cur] = k.split("|"); return <tr key={k} className="border-b border-line"><td className="py-1.5">{PAYMENT_METHOD_LABEL[m]}</td><td className="text-right">{money(fromCents(c), cur)}</td></tr>; })}</tbody></table></>}
        <h2 className="mt-6 text-lg">All payments</h2>
        {rows.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b-2 border-ink text-xs"><th className="py-2 pr-2">Date</th><th className="pr-2">Receipt</th><th className="pr-2">Invoice</th><th className="pr-2">Client</th><th className="pr-2">Service</th><th className="pr-2">Method</th><th className="pr-2">Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{rows.map((p) => <tr key={p.id} className="border-b border-line"><td className="py-1.5 pr-2">{date(p.paidAt)}</td><td className="pr-2"><Link className="text-brand underline no-print" href={`/billing/receipts/${p.id}`}>{p.receiptNumber}</Link><span className="hidden print:inline">{p.receiptNumber}</span></td><td className="pr-2">{p.invoice.number}</td><td className="pr-2">{p.invoice.application.client.name}</td><td className="pr-2">{SERVICE_LABEL[p.invoice.application.service]}</td><td className="pr-2">{PAYMENT_METHOD_LABEL[p.method]}</td><td className="pr-2">{p.reference}</td><td className="text-right">{money(p.amount, p.invoice.currency)}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <div className="mt-2"><Empty title="No payments recorded in this month" /></div>}
        {refunds.length > 0 && (
          <>
            <h2 className="mt-6 text-lg">Refunds paid</h2>
            <table className="mt-2 w-full text-left text-sm"><thead><tr className="border-b-2 border-ink text-xs"><th className="py-2 pr-2">Date</th><th className="pr-2">Refund</th><th className="pr-2">Client</th><th className="pr-2">Application</th><th className="pr-2">Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{refunds.map((r) => <tr key={r.id} className="border-b border-line"><td className="py-1.5 pr-2">{date(r.paidAt)}</td><td className="pr-2">{r.reference}</td><td className="pr-2">{r.client.name}</td><td className="pr-2">{r.application.reference}</td><td className="pr-2">{r.paidReference}</td><td className="text-right">{money(r.paidAmount, r.currency ?? "USD")}</td></tr>)}</tbody></table>
          </>
        )}
      </section>
    </div>
  );
}
