// Refunds and change requests on one application: the client's view (ask, fill in the refund form)
// and the staff view (decide changes; refunds are decided on the Finance → Refunds page).
import Link from "next/link";
import { requestAmendment, requestRefund, submitRefundForm } from "@/app/portal/request-actions";
import { decideAmendment } from "@/app/staff/finance/refund-actions";
import type { FullApplication } from "@/lib/applications";
import { balanceOf, fromCents } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { AMENDMENT_KINDS, AMENDMENT_STATUS, REFUND_STATUS } from "@/lib/requests";
import { ActionForm } from "./action-form";

const Badge = ({ map, k }: { map: Record<string, [string, string]>; k: string }) => <span className={`badge ${map[k][1]}`}>{map[k][0]}</span>;

export function RequestsPanel({ app, mode, canDecide = false, seeRefunds = false }: { app: FullApplication; mode: "client" | "staff"; canDecide?: boolean; seeRefunds?: boolean }) {
  const paidInvoices = app.invoices.filter((i) => i.payments.length > 0);
  const showRefunds = mode === "client" || seeRefunds;
  if (mode === "staff" && !app.amendments.length && !(seeRefunds && app.refunds.length)) return null;
  return (
    <section className="card p-6" aria-labelledby="rq-h">
      <h2 id="rq-h" className="text-xl">{mode === "client" ? "Refunds and changes" : "Change requests and refunds"}</h2>

      {app.amendments.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {app.amendments.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{AMENDMENT_KINDS[a.kind as keyof typeof AMENDMENT_KINDS] ?? a.kind}</p><p className="text-sm muted">Asked {date(a.createdAt)}</p></div>
                <Badge map={AMENDMENT_STATUS} k={a.status} />
              </div>
              <p className="mt-1 whitespace-pre-line text-sm">{a.details}</p>
              {a.decisionNote && <p className="mt-1 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Answer:</span> {a.decisionNote}</p>}
              {mode === "staff" && canDecide && a.status === "REQUESTED" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(["approve", "decline"] as const).map((d) => (
                    <ActionForm key={d} action={decideAmendment} submit={d === "approve" ? "Approve change" : "Decline change"} className="grid gap-2" buttonClass={d === "approve" ? "btn-primary btn-sm justify-self-start" : "btn-ghost btn-sm justify-self-start"}>
                      <input type="hidden" name="amendmentId" value={a.id} /><input type="hidden" name="decision" value={d} />
                      <label className="sr-only" htmlFor={`am-${d}-${a.id}`}>{d === "approve" ? "What happens next" : "Reason"}</label>
                      <textarea id={`am-${d}-${a.id}`} name="note" rows={2} className="input text-sm" placeholder={d === "approve" ? "What happens next (shown to the client)" : "Why (shown to the client)"} />
                    </ActionForm>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showRefunds && app.refunds.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {app.refunds.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">Refund {r.reference}{r.invoice ? ` · ${r.invoice.number}` : ""}</p><p className="text-sm muted">Asked {date(r.createdAt)}{r.amountRequested ? ` · ${money(r.amountRequested, r.currency ?? "USD")} requested` : ""}{r.paidAmount ? ` · ${money(r.paidAmount, r.currency ?? "USD")} paid ${date(r.paidAt)}` : ""}</p></div>
                <Badge map={REFUND_STATUS} k={r.status} />
              </div>
              {r.decisionNote && <p className="mt-1 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Finance:</span> {r.decisionNote}</p>}
              {mode === "staff" && <Link href="/staff/finance/refunds" className="mt-1 inline-block text-sm font-semibold text-brand underline">Open in Refunds</Link>}
              {mode === "client" && r.status === "FORM_OPEN" && (() => {
                const inv = app.invoices.find((i) => i.id === r.invoiceId);
                const paid = inv ? balanceOf({ ...inv, status: "ISSUED" }).paid : 0;
                return (
                  <div className="mt-3 rounded-xl border-2 border-brand/30 p-4">
                    <h3 className="text-base">Refund form</h3>
                    <p className="text-sm muted">Your request was approved. Tell us how much and where to send it.</p>
                    <ActionForm action={submitRefundForm} submit="Send refund form" className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="refundId" value={r.id} />
                      <div><label className="label" htmlFor={`ra-${r.id}`}>Amount ({r.currency}; up to {fromCents(paid)})</label><input id={`ra-${r.id}`} name="amount" inputMode="decimal" defaultValue={fromCents(paid)} className="input" required /></div>
                      <div><label className="label" htmlFor={`rm-${r.id}`}>Pay me by</label><select id={`rm-${r.id}`} name="method" className="input" defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
                      <div><label className="label" htmlFor={`rn-${r.id}`}>Name on the account</label><input id={`rn-${r.id}`} name="accountName" className="input" required maxLength={120} autoComplete="name" /></div>
                      <div><label className="label" htmlFor={`rd-${r.id}`}>Mobile money number, or bank and account number</label><input id={`rd-${r.id}`} name="accountDetails" className="input" required maxLength={300} /></div>
                      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="declaration" className="mt-1 size-4 accent-brand" /> I confirm these details are correct and the account is mine.</label>
                    </ActionForm>
                  </div>
                );
              })()}
            </li>
          ))}
        </ul>
      )}

      {mode === "client" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {app.status === "ACTIVE" && (
            <details className="rounded-xl bg-mist p-4">
              <summary className="cursor-pointer font-semibold text-brand">Ask to change something</summary>
              <ActionForm action={requestAmendment} submit="Send change request" className="mt-3 grid gap-3">
                <input type="hidden" name="applicationId" value={app.id} />
                <div><label className="label" htmlFor="am-kind">What do you want to change?</label><select id="am-kind" name="kind" className="input" defaultValue="CHANGE_DETAILS">{Object.entries(AMENDMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label" htmlFor="am-details">Details</label><textarea id="am-details" name="details" rows={3} className="input" required maxLength={2000} /></div>
              </ActionForm>
            </details>
          )}
          {paidInvoices.length > 0 && (
            <details className="rounded-xl bg-mist p-4">
              <summary className="cursor-pointer font-semibold text-brand">Request a refund</summary>
              <p className="mt-2 text-sm muted">Finance reviews every request. If it&apos;s approved, you&apos;ll fill in a short form with how to pay you.</p>
              <ActionForm action={requestRefund} submit="Send refund request" className="mt-3 grid gap-3">
                <input type="hidden" name="applicationId" value={app.id} />
                <div><label className="label" htmlFor="rf-inv">Payment to refund</label><select id="rf-inv" name="invoiceId" className="input">{paidInvoices.map((i) => <option key={i.id} value={i.id}>{i.number}: {i.description} ({money(fromCents(balanceOf({ ...i, status: "ISSUED" }).paid), i.currency)} paid)</option>)}</select></div>
                <div><label className="label" htmlFor="rf-reason">Why are you asking for a refund?</label><textarea id="rf-reason" name="reason" rows={3} className="input" required maxLength={2000} /></div>
              </ActionForm>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
