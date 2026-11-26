import Link from "next/link";
import { issueInvoice, recordPayment, voidInvoice } from "@/app/staff/finance/actions";
import { applyFeePlan, removeFeePlan } from "@/app/staff/finance/fee-actions";
import type { FeePlan, Installment } from "@/lib/fees";
import { nowMs } from "@/lib/finance";
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
type RuleChoice = { id: string; name: string; amount: string; currency: string; installments: unknown };

/** Consultants see whether each instalment is cleared, never amounts or payment details. */
function Clearance({ app }: { app: FullApplication }) {
  const invs = app.invoices.filter((i) => i.status !== "VOID").sort((a, b) => +a.createdAt - +b.createdAt);
  const now = nowMs();
  const state = (i: (typeof invs)[number]) => i.status === "PAID" ? ["Cleared", "bg-emerald-50 text-emerald-700"] : i.dueDate && +i.dueDate < now ? ["Overdue", "bg-red-50 text-red-700"] : i.status === "PARTIALLY_PAID" ? ["Part paid", "bg-blue-50 text-brand"] : ["Not paid yet", "bg-amber-50 text-amber-800"];
  return (
    <section className="card p-6" aria-labelledby="clr-h">
      <h2 id="clr-h" className="text-xl">Payment clearance</h2>
      <p className="mt-1 text-sm muted">Amounts and payment details are kept with Finance. You&apos;re notified when a payment is recorded.</p>
      {invs.length ? <ul className="mt-3 divide-y divide-line">{invs.map((i) => { const [t, c] = state(i); return <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span>{i.description}{i.dueDate ? <span className="muted"> · due {date(i.dueDate)}</span> : null}</span><span className={`badge ${c}`}>{t}</span></li>; })}</ul>
        : <p className="mt-2 text-sm muted">No fees issued yet.</p>}
      {invs.length > 0 && <p className="mt-3 text-sm font-semibold">{invs.every((i) => i.status === "PAID") ? "All issued fees are cleared." : "Some fees are not cleared yet."}</p>}
    </section>
  );
}

function FeePlanBox({ app, rules, finance }: { app: FullApplication; rules: RuleChoice[]; finance: boolean }) {
  const plan = app.feePlan as FeePlan | null;
  if (plan) {
    const paid = app.invoices.filter((i) => plan.installments.some((x) => x.invoiceId === i.id)).reduce((n, i) => n + balanceOf(i).paid, 0);
    const total = Math.round(Number(plan.amount) * 100);
    const refunded = app.refunds.filter((r) => r.status === "PAID" && plan.installments.some((x) => x.invoiceId === r.invoiceId)).reduce((n, r) => n + Math.round(Number(r.paidAmount) * 100), 0);
    return (
      <div className="mt-3 rounded-xl bg-mist p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs muted">Service fee{finance ? ` (${plan.ruleName})` : ""}</p><p className="font-display text-xl font-extrabold">{money(plan.amount, plan.currency)}</p></div>
          <div><p className="text-xs muted">Paid</p><p className="font-display text-xl font-extrabold text-emerald-700">{money(fromCents(paid), plan.currency)}</p></div>
          <div><p className="text-xs muted">Remaining</p><p className="font-display text-xl font-extrabold">{money(fromCents(Math.max(total - paid, 0)), plan.currency)}</p></div>
        </div>
        {refunded > 0 && <p className="mt-2 text-sm font-semibold">Refunded: {money(fromCents(refunded), plan.currency)}</p>}
        <p className="mt-2 text-xs muted">Agreed on {date(new Date(plan.appliedAt))} in {plan.installments.length} instalment{plan.installments.length === 1 ? "" : "s"}; this price doesn&apos;t change if fees change later.</p>
        {finance && (
          <details className="mt-2"><summary className="cursor-pointer text-xs text-red-700">Remove this fee plan</summary>
            <ActionForm action={removeFeePlan} submit="Remove and void its invoices" className="mt-2 flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm">
              <input type="hidden" name="applicationId" value={app.id} />
              <label className="sr-only" htmlFor="rm-fp">Reason</label><input id="rm-fp" name="reason" required placeholder="Reason (e.g. wrong fee chosen)" className="input min-h-9 flex-1 py-1.5 text-sm" />
            </ActionForm>
          </details>
        )}
      </div>
    );
  }
  if (!finance || app.status !== "ACTIVE") return null;
  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-brand/30 p-4">
      <h3 className="text-base">Apply a fee plan</h3>
      {rules.length ? (
        <ActionForm action={applyFeePlan} submit="Apply fee plan and issue invoices" pendingLabel="Applying…" className="mt-2 grid gap-2">
          <input type="hidden" name="applicationId" value={app.id} />
          <label className="label" htmlFor="fp-rule">Fee (most specific first)</label>
          <select id="fp-rule" name="ruleId" className="input" defaultValue={rules[0].id}>{rules.map((r) => <option key={r.id} value={r.id}>{r.name}: {money(r.amount, r.currency)}, {(r.installments as Installment[]).map((x) => `${x.percent}%`).join(" / ")}</option>)}</select>
        </ActionForm>
      ) : <p className="mt-1 text-sm muted">No fee applies to this application yet. <Link className="font-semibold text-brand underline" href="/staff/finance/fees">Set up service fees</Link>, or issue an invoice by hand below.</p>}
    </div>
  );
}

export function InvoicesPanel({ app, mode, rules = [] }: { app: FullApplication; mode: "client" | "finance" | "summary"; rules?: RuleChoice[] }) {
  if (mode === "summary") return <Clearance app={app} />;
  const invs = [...app.invoices].sort((a, b) => +a.createdAt - +b.createdAt);
  const open = invs.filter((i) => i.status !== "VOID");
  const byCur = new Map<string, number>();
  for (const i of open) byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + balanceOf(i).due);
  const dueText = [...byCur].filter(([, c]) => c > 0).map(([cur, c]) => money(fromCents(c), cur)).join(" + ");
  const links = true;
  return (
    <section className="card p-6" aria-labelledby="inv-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="inv-h" className="text-xl">Invoices and payments</h2>
        {open.length > 0 && <p className="text-sm font-semibold">{dueText ? <>Balance due: <span className="text-amber-800">{dueText}</span></> : <span className="text-emerald-700">Fully paid</span>}</p>}
      </div>
      <FeePlanBox app={app} rules={rules} finance={mode === "finance"} />
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
          <h3 className="text-base">Issue a separate invoice</h3>
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
