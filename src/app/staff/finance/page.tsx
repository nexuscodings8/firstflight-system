import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { balanceOf, currentMonth, fromCents, nowMs } from "@/lib/finance";
import { date, label, money } from "@/lib/format";
import { INVOICE_BADGE } from "@/components/invoices-panel";
import { Empty } from "@/components/cards";

export const metadata = { title: "Finance" };

const FILTERS = { open: ["ISSUED", "PARTIALLY_PAID"], paid: ["PAID"], void: ["VOID"], all: ["ISSUED", "PARTIALLY_PAID", "PAID", "VOID"] } as const;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser(["FINANCE", "ADMIN"], "/staff/finance");
  const show = ((await searchParams).show ?? "open") as keyof typeof FILTERS;
  const statuses = FILTERS[show] ?? FILTERS.open;
  const [invs, apps] = await Promise.all([
    db.query.invoices.findMany({ where: inArray(s.invoices.status, [...statuses]), orderBy: [desc(s.invoices.createdAt)], limit: 300, with: { payments: true, application: { columns: { id: true, reference: true }, with: { client: { columns: { name: true } } } } } }),
    db.query.applications.findMany({ where: eq(s.applications.status, "ACTIVE"), orderBy: [asc(s.applications.reference)], columns: { id: true, reference: true }, with: { client: { columns: { name: true } } } }),
  ]);
  const outstanding = new Map<string, number>();
  for (const i of invs) if (i.status !== "VOID") outstanding.set(i.currency, (outstanding.get(i.currency) ?? 0) + balanceOf(i).due);
  const thisMonth = currentMonth();
  const now = nowMs();
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[clamp(26px,3vw,36px)]">Finance</h1>
        <div className="flex flex-wrap gap-2"><Link href="/staff/finance/fees" className="btn-ghost btn-sm">Service fees</Link><Link href="/staff/finance/refunds" className="btn-ghost btn-sm">Refunds</Link><Link href={`/staff/finance/report?month=${thisMonth}`} className="btn-primary btn-sm">Monthly payment report</Link></div>
      </div>
      {show === "open" && <div className="card p-5"><p className="text-sm muted">Outstanding on open invoices</p><p className="font-display text-2xl font-extrabold">{[...outstanding].filter(([, c]) => c > 0).map(([cur, c]) => money(fromCents(c), cur)).join(" + ") || "Nothing outstanding"}</p></div>}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Invoices</h2>
          <nav aria-label="Filter invoices" className="flex flex-wrap gap-1 text-sm">{(["open", "paid", "void", "all"] as const).map((k) => <Link key={k} href={`/staff/finance?show=${k}`} aria-current={show === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${show === k ? "bg-brand text-white" : "hover:bg-mist"}`}>{k === "open" ? "Unpaid" : label(k)}</Link>)}</nav>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-3">Invoice</th><th className="pr-3">Client</th><th className="pr-3">Application</th><th className="pr-3">Amount</th><th className="pr-3">Balance</th><th className="pr-3">Due</th><th>Status</th></tr></thead>
            <tbody>{invs.map((i) => { const b = balanceOf(i); return (
              <tr key={i.id} className="border-b border-line">
                <td className="py-2.5 pr-3"><Link className="font-semibold text-brand underline" href={`/billing/invoices/${i.id}`}>{i.number}</Link><p className="text-xs muted">{i.description}</p></td>
                <td className="pr-3">{i.application.client.name}</td>
                <td className="pr-3"><Link className="text-brand underline" href={`/staff/applications/${i.application.id}`}>{i.application.reference}</Link></td>
                <td className="pr-3">{money(i.amount, i.currency)}</td><td className="pr-3 font-semibold">{money(fromCents(b.due), i.currency)}</td>
                <td className={`pr-3 ${i.dueDate && +i.dueDate < now && b.due > 0 ? "font-semibold text-red-700" : ""}`}>{date(i.dueDate)}</td>
                <td><span className={`badge ${INVOICE_BADGE[i.status]}`}>{i.status === "PARTIALLY_PAID" ? "Part paid" : label(i.status)}</span></td>
              </tr>); })}</tbody>
          </table>
        </div>
        {!invs.length && <Empty title="No invoices here" />}
      </section>
      <section className="card p-5">
        <h2 className="text-xl">Issue an invoice</h2>
        <p className="mt-1 text-sm muted">Invoices are issued from the application, so they stay linked to the client&apos;s file. Open one:</p>
        <ul className="mt-3 flex flex-wrap gap-2">{apps.map((a) => <li key={a.id}><Link className="badge bg-mist px-3 py-1.5 text-sm text-brand hover:bg-brand hover:text-white" href={`/staff/applications/${a.id}`}>{a.reference} · {a.client.name}</Link></li>)}</ul>
      </section>
    </div>
  );
}
