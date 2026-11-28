import Link from "next/link";
import { issueInvoice, recordPayment, voidInvoice } from "@/app/staff/finance/actions";
import { removeFeePlan, startFromRule } from "@/app/staff/finance/fee-actions";
import { planConfirmed, type Condition, type FeePlan, type Installment } from "@/lib/fees";
import { conditionOf, conditionText, loanAllowed } from "@/lib/schedule";
import { ScheduleForm } from "./schedule-form";
import { nowMs } from "@/lib/finance";
import { CURRENCIES, PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { date, label, money } from "@/lib/format";
import type { FullApplication } from "@/lib/applications";
import { ActionForm } from "./action-form";
import { PaymentSubmitForm } from "./payment-submit-form";
import { LoanRequestForm } from "./loan-request-form";
import { sendToClient } from "@/app/staff/finance/billing-actions";

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
      {scheduleRows(app).length > 0 && (
        <ol className="mt-3 divide-y divide-line" aria-label="Instalment schedule">
          {scheduleRows(app).map((r) => <li key={r.i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" data-testid="instalment"><span>Instalment {r.i + 1}: {r.label}<span className="muted"> · {r.historical ? "paid before the platform" : conditionText(r.condition, "staff").toLowerCase()}</span></span><span className={`badge ${ROW_BADGE[r.state][1]}`}>{r.state === "PAID" ? "Cleared" : ROW_BADGE[r.state][0]}</span></li>)}
        </ol>
      )}
      {scheduleRows(app).length ? null : invs.length ? <ul className="mt-3 divide-y divide-line">{invs.map((i) => { const [t, c] = state(i); return <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span>{i.description}{i.dueDate ? <span className="muted"> · due {date(i.dueDate)}</span> : null}</span><span className={`badge ${c}`}>{t}</span></li>; })}</ul>
        : <p className="mt-2 text-sm muted">No fees issued yet.</p>}
      {invs.length > 0 && <p className="mt-3 text-sm font-semibold">{invs.every((i) => i.status === "PAID") ? "All issued fees are cleared." : "Some fees are not cleared yet."}</p>}
    </section>
  );
}

type RowView = { i: number; label: string; amount: string; condition: Condition; state: "PAID" | "PART" | "DUE" | "SCHEDULED" | "HISTORICAL_PENDING"; invoiceNumber: string | null; loan: boolean; historical: boolean; dueDate: string | null };
/** Each instalment of the schedule with where it stands. */
export function scheduleRows(app: FullApplication): RowView[] {
  const plan = app.feePlan as FeePlan | null;
  if (!plan) return [];
  const byId = new Map(app.invoices.map((x) => [x.id, x]));
  return plan.installments.map((r, i) => {
    const inv = r.invoiceId ? byId.get(r.invoiceId) : undefined;
    const state: RowView["state"] = inv ? (inv.status === "PAID" ? "PAID" : inv.status === "PARTIALLY_PAID" ? "PART" : "DUE") : r.historical ? "HISTORICAL_PENDING" : "SCHEDULED";
    return { i, label: r.label, amount: r.amount, condition: conditionOf(r), state, invoiceNumber: r.invoiceNumber, loan: loanAllowed(plan, i), historical: !!r.historical, dueDate: inv?.dueDate ? inv.dueDate.toISOString() : null };
  });
}
const ROW_BADGE: Record<RowView["state"], [string, string]> = {
  PAID: ["Paid", "bg-emerald-50 text-emerald-700"], PART: ["Part paid", "bg-blue-50 text-brand"], DUE: ["Payable now", "bg-amber-50 text-amber-800"],
  SCHEDULED: ["Scheduled", "bg-slate-100 text-slate-600"], HISTORICAL_PENDING: ["Paid before the platform: Finance confirming", "bg-slate-100 text-slate-600"],
};

function ScheduleBox({ app, rules, finance, client }: { app: FullApplication; rules: RuleChoice[]; finance: boolean; client: boolean }) {
  const plan = app.feePlan as FeePlan | null;
  const confirmed = planConfirmed(plan);
  const rows = scheduleRows(app);
  if (!plan) {
    if (!finance || app.status !== "ACTIVE") return client ? <p className="mt-2 text-sm muted">Finance will confirm your service fee and payment schedule.</p> : null;
    return (
      <div className="mt-3 rounded-xl border-2 border-dashed border-brand/30 p-4" id="schedule">
        <h3 className="text-base">Set the instalment schedule</h3>
        {rules.length > 0 && (
          <ActionForm action={startFromRule} submit="Start from this fee" className="mt-2 flex flex-wrap items-end gap-2" buttonClass="btn-ghost btn-sm">
            <input type="hidden" name="applicationId" value={app.id} />
            <div className="min-w-64 flex-1"><label className="label" htmlFor="fp-rule">Fee (most specific first)</label>
              <select id="fp-rule" name="ruleId" className="input" defaultValue={rules[0].id}>{rules.map((r) => <option key={r.id} value={r.id}>{r.name}: {money(r.amount, r.currency)}, {(r.installments as Installment[]).map((x) => `${x.percent}%`).join(" / ")}</option>)}</select></div>
          </ActionForm>
        )}
        <p className="mt-2 text-sm muted">{rules.length ? "Or set the amounts yourself:" : <>No fee rule applies. <Link className="font-semibold text-brand underline" href="/staff/finance/fees">Set up service fees</Link>, or set the amounts yourself:</>}</p>
        <ScheduleForm applicationId={app.id} service={app.service} currency={app.invoices[0]?.currency ?? "USD"} total="" rows={[]} confirmed={false} existingClient={app.origin === "EXISTING"} currencies={CURRENCIES} lockedPrice={null} />
      </div>
    );
  }
  const live = app.invoices.filter((x) => x.status !== "VOID" && x.currency === plan.currency);
  const paid = live.reduce((n, x) => n + balanceOf(x).paid, 0);
  const total = Math.round(Number(plan.amount) * 100);
  const payable = live.reduce((n, x) => n + balanceOf(x).due, 0);
  const scheduled = rows.filter((r) => r.state === "SCHEDULED" || r.state === "HISTORICAL_PENDING").reduce((n, r) => n + Math.round(Number(r.amount) * 100), 0);
  const refunded = app.refunds.filter((r) => r.state === "COMPLETED" && r.kind === "REFUND").reduce((n, r) => n + Math.round(Number(r.paidAmount ?? 0) * 100), 0);
  const form = finance && app.status === "ACTIVE" ? (
    <ScheduleForm applicationId={app.id} service={app.service} currency={plan.currency} total={plan.amount} confirmed={confirmed} existingClient={app.origin === "EXISTING"} currencies={CURRENCIES} lockedPrice={confirmed ? null : money(plan.amount, plan.currency)}
      rows={plan.installments.map((r) => ({ label: r.label, amount: r.amount, condition: conditionOf(r), dueDays: r.dueDays ?? 7, loanEligible: !!r.loanEligible, historical: !!r.historical, locked: confirmed && !!r.invoiceId, invoiceNumber: r.invoiceNumber }))} />
  ) : null;
  return (
    <div className="mt-3 rounded-xl bg-mist p-4" id="schedule" data-testid="schedule">
      <div className="grid gap-3 sm:grid-cols-4">
        <div><p className="text-xs muted">Total agreed fee{finance ? ` (${plan.ruleName})` : ""}</p><p className="font-display text-xl font-extrabold">{money(plan.amount, plan.currency)}</p></div>
        <div><p className="text-xs muted">Already paid</p><p className="font-display text-xl font-extrabold text-emerald-700" data-testid="amount-paid">{money(fromCents(paid), plan.currency)}</p></div>
        <div><p className="text-xs muted">Payable now</p><p className="font-display text-xl font-extrabold text-amber-800" data-testid="amount-payable">{money(fromCents(payable), plan.currency)}</p></div>
        <div><p className="text-xs muted">Scheduled for later</p><p className="font-display text-xl font-extrabold">{money(fromCents(scheduled), plan.currency)}</p></div>
      </div>
      <p className="mt-2 text-sm">Remaining balance: <strong data-testid="remaining">{money(fromCents(Math.max(total - paid, 0)), plan.currency)}</strong>{refunded > 0 && <> · Refunded: <strong>{money(fromCents(refunded), plan.currency)}</strong></>}</p>
      {!confirmed && <p className="mt-2 rounded-lg bg-white p-2 text-sm">{client ? "Your price is locked in. Finance will confirm the payment schedule at the initial invoice stage, and you'll only be asked to pay each instalment when it becomes payable." : "Draft: price locked when the client applied. Confirm the schedule at initial invoicing; nothing is invoiced before that."}</p>}
      <ol className="mt-3 divide-y divide-line rounded-xl bg-white" aria-label="Instalment schedule">
        {rows.map((r) => (
          <li key={r.i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm" data-testid="instalment">
            <div><p className="font-semibold">Instalment {r.i + 1}: {r.label} · {money(r.amount, plan.currency)}</p>
              <p className="muted">{r.historical ? "Paid before the platform" : conditionText(r.condition, client ? "client" : "staff")}{r.invoiceNumber ? ` · invoice ${r.invoiceNumber}` : ""}{r.dueDate && r.state !== "PAID" ? ` · due ${date(r.dueDate)}` : ""}{r.loan ? " · loan possible" : ""}</p></div>
            <span className={`badge ${ROW_BADGE[r.state][1]}`}>{confirmed || r.state !== "SCHEDULED" ? ROW_BADGE[r.state][0] : "Proposed"}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs muted">Price agreed on {date(new Date(plan.appliedAt))}{plan.confirmedAt ? `; schedule confirmed on ${date(new Date(plan.confirmedAt))}${finance && plan.confirmedBy ? ` by ${plan.confirmedBy}` : ""}` : ""}. It doesn&apos;t change if public prices change later.</p>
      {form && (confirmed ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-brand">Change instalments not invoiced yet</summary>{form}</details> : <div className="mt-3"><h3 className="text-base">Confirm the instalment schedule</h3>{form}</div>)}
      {finance && !rows.some((r) => r.invoiceNumber) && app.status === "ACTIVE" && (
        <details className="mt-2"><summary className="cursor-pointer text-xs text-red-700">Remove this fee plan</summary>
          <ActionForm action={removeFeePlan} submit="Remove the fee plan" className="mt-2 flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm">
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="sr-only" htmlFor="rm-fp">Reason</label><input id="rm-fp" name="reason" required placeholder="Reason (e.g. wrong fee chosen)" className="input min-h-9 flex-1 py-1.5 text-sm" />
          </ActionForm>
        </details>
      )}
    </div>
  );
}

export function InvoicesPanel({ app, mode, rules = [], notices }: { app: FullApplication; mode: "client" | "finance" | "summary"; rules?: RuleChoice[]; notices?: React.ReactNode }) {
  if (mode === "summary") return <Clearance app={app} />;
  const invs = [...app.invoices].sort((a, b) => +a.createdAt - +b.createdAt);
  const subs = app.paymentSubmissions ?? [];
  const loans = app.loanRequests ?? [];
  const plan = app.feePlan as FeePlan | null;
  const open = invs.filter((i) => i.status !== "VOID");
  const byCur = new Map<string, number>();
  for (const i of open) byCur.set(i.currency, (byCur.get(i.currency) ?? 0) + balanceOf(i).due);
  const dueText = [...byCur].filter(([, c]) => c > 0).map(([cur, c]) => money(fromCents(c), cur)).join(" + ");
  const links = true;
  return (
    <section className="card p-6" aria-labelledby="inv-h" id="invoices">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="inv-h" className="text-xl">Invoices and payments</h2>
        {open.length > 0 && <p className="text-sm font-semibold">{dueText ? <>Balance due: <span className="text-amber-800">{dueText}</span></> : <span className="text-emerald-700">Fully paid</span>}</p>}
      </div>
      {notices}
      <ScheduleBox app={app} rules={rules} finance={mode === "finance"} client={mode === "client"} />
      {!invs.length && <p className="mt-2 text-sm muted">{mode === "client" ? "No invoices yet. You're invoiced for each instalment only when it becomes payable." : "No invoices on this application yet."}</p>}
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
              {inv.status !== "VOID" && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <a className="text-brand underline" href={`/billing/invoices/${inv.id}/pdf`}>Download PDF</a>
                  {mode === "finance" && <ActionForm action={sendToClient} submit={inv.sentAt ? `Sent ${date(inv.sentAt)}: send again` : "Send invoice to client"} className="grid" buttonClass="text-sm font-semibold text-brand underline" resetOnSuccess={false}><input type="hidden" name="kind" value="invoice" /><input type="hidden" name="id" value={inv.id} /></ActionForm>}
                </div>
              )}
              {subs.filter((x) => x.invoiceId === inv.id && x.status !== "APPROVED").map((x) => (
                <p key={x.id} className={`mt-2 rounded-lg px-3 py-2 text-sm ${x.status === "PENDING" ? "bg-blue-50" : "bg-red-50"}`}>
                  {x.status === "PENDING" ? "Waiting for Finance: " : "Not accepted: "}{money(x.amount, inv.currency)} · {PAYMENT_METHOD_LABEL[x.method]}{x.loanFunded ? ` (loan: ${x.loanProvider})` : ""} · {x.reference} · submitted {date(x.createdAt)}
                  {x.status === "REJECTED" && x.rejectionReason && <span className="block font-semibold text-red-800">{x.rejectionReason}</span>}
                  {x.status === "PENDING" && mode === "finance" && <Link className="ml-2 font-semibold text-brand underline" href="/staff/finance/verify">Verify</Link>}
                </p>
              ))}
              {loans.filter((l) => l.invoiceId === inv.id).map((l) => (
                <p key={l.id} className={`mt-2 rounded-lg px-3 py-2 text-sm ${l.status === "PENDING_REVIEW" ? "bg-blue-50" : l.status === "APPROVED" ? "bg-emerald-50" : "bg-red-50"}`} data-testid="loan-status">
                  Loan request {l.reference}: {l.status === "PENDING_REVIEW" ? "pending review (not counted as paid)" : l.status === "APPROVED" ? `approved, ${money(l.approvedAmount, inv.currency)} from ${l.approvedProvider}` : "not accepted"} · {money(l.amountRequested, inv.currency)} from {l.provider}
                  {l.status === "REJECTED" && l.decisionNote && <span className="block font-semibold text-red-800">{l.decisionNote}</span>}
                  {l.status === "PENDING_REVIEW" && mode === "finance" && <Link className="ml-2 font-semibold text-brand underline" href="/staff/finance/loans">Review</Link>}
                </p>
              ))}
              {mode === "client" && (inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && (() => {
                const pendingSubs = subs.filter((x) => x.invoiceId === inv.id && x.status === "PENDING").reduce((n, x) => n + Math.round(Number(x.amount) * 100), 0);
                const idx = plan?.installments.findIndex((r) => r.invoiceId === inv.id) ?? -1;
                const loanOk = idx >= 0 && loanAllowed(plan, idx) && !loans.some((l) => l.invoiceId === inv.id && l.status === "PENDING_REVIEW");
                return <>
                  <details className="mt-3 rounded-xl border border-line p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">{loanOk ? "Pay final instalment" : `I've paid ${inv.number}: submit payment`}</summary>
                    <PaymentSubmitForm invoiceId={inv.id} number={inv.number} currency={inv.currency} due={fromCents(Math.max(b.due - pendingSubs, 0))} />
                  </details>
                  {loanOk && (
                    <details className="mt-2 rounded-xl border border-line p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand">Request loan-based payment</summary>
                      <LoanRequestForm invoiceId={inv.id} currency={inv.currency} due={fromCents(b.due)} />
                    </details>
                  )}
                </>;
              })()}
              {inv.payments.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-mist px-3 py-1.5">
                      <span>{money(p.amount, inv.currency)} · {PAYMENT_METHOD_LABEL[p.method]}{p.loanFunded ? ` (loan: ${p.loanProvider})` : ""} · {date(p.paidAt)} ·</span>
                      <Link className="font-semibold text-brand underline" href={`/billing/receipts/${p.id}`}>Receipt {p.receiptNumber}</Link>
                      <a className="text-brand underline" href={`/billing/receipts/${p.id}/pdf`}>PDF</a>
                      {mode === "finance" && <ActionForm action={sendToClient} submit={p.receiptSentAt ? "Send again" : "Send receipt to client"} className="ml-auto grid" buttonClass="text-xs font-semibold text-brand underline" resetOnSuccess={false}><input type="hidden" name="kind" value="receipt" /><input type="hidden" name="id" value={p.id} /></ActionForm>}
                    </li>
                  ))}
                </ul>
              )}
              {mode === "finance" && inv.status !== "VOID" && b.due > 0 && (
                <details className="mt-3 rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Record a payment on {inv.number}</summary>
                  <ActionForm action={recordPayment} submit="Record payment and issue receipt" pendingLabel="Recording…" className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <div><label className="label" htmlFor={`pa-${inv.id}`}>Amount ({inv.currency})</label><input id={`pa-${inv.id}`} name="amount" inputMode="decimal" className="input" defaultValue={fromCents(b.due)} required /></div>
                    <div><label className="label" htmlFor={`pm-${inv.id}`}>Method</label><select id={`pm-${inv.id}`} name="method" className="input" required defaultValue="MOBILE_MONEY">{Object.entries(PAYMENT_METHOD_LABEL).filter(([k]) => k !== "LOAN").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
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
