import Link from "next/link";
import { issueInvoice, recordPayment, voidInvoice } from "@/app/staff/finance/actions";
import { CURRENCIES, PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { date, label, money } from "@/lib/format";
import type { FullApplication } from "@/lib/applications";
import { ActionForm } from "./action-form";

export const INVOICE_BADGE: Record<string, string> = {
  ISSUED: "bg-amber-50 text-amber-800", PARTIALLY_PAID: "bg-blue-50 text-brand", PAID: "bg-emerald-50 text-emerald-700", VOID: "bg-slate-100 text-slate-500", DRAFT: "bg-slate-100 text-slate-600",
};

/**
 * Invoices on one application.
 * mode "client": own invoices with links; "finance": plus issue/record/void; "summary": totals only (consultants).
 */
export function InvoicesPanel({ app, mode }: { app: FullApplication; mode: "client" | "finance" | "summary" }) {
  const invs = [...app.invoices].sort((a, b) => +a.createdAt - +b.createdAt);
  const open = invs.filter((i) => i.status !== "VOID");
  const byCur = new Map<string, number>();
  for (const i of open) byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + balanceOf(i).due);
  const dueText = [...byCur].filter(([, c]) => c > 0).map(([cur, c]) => money(fromCents(c), cur)).join(" + ");
  const links = mode !== "summary";
  return (
    <section className="card p-6" aria-labelledby="inv-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="inv-h" className="text-xl">Invoices and payments</h2>
        {open.length > 0 && <p className="text-sm font-semibold">{dueText ? <>Balance due: <span className="text-amber-800">{dueText}</span></> : <span className="text-emerald-700">Fully paid</span>}</p>}
      </div>
      {!invs.length && <p className="mt-2 text-sm muted">{mode === "client" ? "No invoices yet. Finance will issue them when your file moves to payment." : "No invoices on this application yet."}</p>}
      <ul className="mt-3 divide-y divide-line">
        {invs.map((inv) => {
          const b = balanceOf(inv);
          return (
            <li key={inv.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{links ? <Link className="text-brand underline" href={`/billing/invoices/${inv.id}`}>{inv.number}</Link> : inv.number} · {inv.description}</p>
                  <p className="text-sm muted">{money(inv.amount, inv.currency)} · issued {date(inv.createdAt)}{inv.dueDate ? ` · due ${date(inv.dueDate)}` : ""}{inv.status !== "VOID" ? ` · paid ${money(fromCents(b.paid), inv.currency)} · balance ${money(fromCents(b.due), inv.currency)}` : ""}</p>
                </div>
                <span className={`badge ${INVOICE_BADGE[inv.status]}`}>{inv.status === "PARTIALLY_PAID" ? "Part paid" : label(inv.status)}</span>
              </div>
              {inv.payments.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {inv.payments.map((p) => <li key={p.id} className="rounded-lg bg-mist px-3 py-1.5">{money(p.amount, inv.currency)} · {PAYMENT_METHOD_LABEL[p.method]} · {date(p.paidAt)} · {links ? <Link className="font-semibold text-brand underline" href={`/billing/receipts/${p.id}`}>Receipt {p.receiptNumber}</Link> : `Receipt ${p.receiptNumber}`}</li>)}
                </ul>
              )}
              {mode === "finance" && inv.status !== "VOID" && b.due > 0 && (
                <details className="mt-3 rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Record a payment on {inv.number}</summary>
                  <ActionForm action={recordPayment} submit="Record payment and issue receipt" pendingLabel="Recording…" className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <div><label className="label" htmlFor={`pa-${inv.id}`}>Amount ({inv.currency})</label><input id={`pa-${inv.id}`} name="amount" inputMode="decimal" className="input" defaultValue={fromCents(b.due)} required /></div>
                    <div><label className="label" htmlFor={`pm-${inv.id}`}>Method</label><select id={`pm-${inv.id}`} name="method" className="input" required defaultValue="MOBILE_MONEY">{Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    <div><label className="label" htmlFor={`pr-${inv.id}`}>Payment reference</label><input id={`pr-${inv.id}`} name="reference" className="input" placeholder="Transaction ID or cash book number" required maxLength={80} /></div>
                    <div><label className="label" htmlFor={`pd-${inv.id}`}>Date paid</label><input id={`pd-${inv.id}`} name="paidAt" type="date" className="input" required /></div>
                    <div className="sm:col-span-2"><label className="label" htmlFor={`pn-${inv.id}`}>Note (optional)</label><input id={`pn-${inv.id}`} name="note" className="input" maxLength={300} /></div>
                  </ActionForm>
                </details>
              )}
              {mode === "finance" && inv.status !== "VOID" && inv.payments.length === 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-red-700">Void {inv.number}</summary>
                  <ActionForm action={voidInvoice} submit="Void invoice" pendingLabel="Voiding…" className="mt-2 flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <label className="sr-only" htmlFor={`v-${inv.id}`}>Reason for voiding</label>
                    <input id={`v-${inv.id}`} name="reason" className="input min-h-9 flex-1 py-1.5 text-sm" placeholder="Reason (e.g. wrong amount)" required maxLength={300} />
                  </ActionForm>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {mode === "finance" && app.status !== "WITHDRAWN" && (
        <div className="mt-4 rounded-xl bg-mist p-4">
          <h3 className="text-base">Issue a new invoice</h3>
          <ActionForm action={issueInvoice} submit="Issue invoice" pendingLabel="Issuing…" className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <div className="sm:col-span-2"><label className="label" htmlFor="in-desc">What it is for</label><input id="in-desc" name="description" className="input" placeholder={`e.g. Instalment ${invs.filter((i) => i.status !== "VOID").length + 1}: processing fee`} required maxLength={200} /></div>
            <div><label className="label" htmlFor="in-amt">Amount</label><input id="in-amt" name="amount" inputMode="decimal" className="input" placeholder="450.00" required /></div>
            <div><label className="label" htmlFor="in-cur">Currency</label><select id="in-cur" name="currency" className="input" defaultValue={invs[0]?.currency ?? "USD"}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor="in-due">Due date (optional)</label><input id="in-due" name="dueDate" type="date" className="input" /></div>
          </ActionForm>
        </div>
      )}
    </section>
  );
}
