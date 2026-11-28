// Refunds and change requests on one application: the client's view (ask, fill in the refund form)
// and the staff view (decide changes; refunds are decided on the Finance → Refunds page).
import Link from "next/link";
import { requestAmendment } from "@/app/portal/request-actions";
import { decideAmendment } from "@/app/staff/finance/refund-actions";
import type { FullApplication } from "@/lib/applications";
import { date, money } from "@/lib/format";
import { AMENDMENT_KINDS, AMENDMENT_STATUS } from "@/lib/requests";
import { KIND_LABEL, OPEN_STATES, STATE_BADGE } from "@/lib/refunds";
import type { RefundInfo } from "@/lib/refund-info";
import { RefundTrack } from "./refund-track";
import { RefundForm } from "./refund-form";
import { ActionForm } from "./action-form";

const Badge = ({ map, k }: { map: Record<string, [string, string]>; k: string }) => <span className={`badge ${map[k][1]}`}>{map[k][0]}</span>;

export function RequestsPanel({ app, mode, canDecide = false, seeRefunds = false, refund, notices }: { app: FullApplication; mode: "client" | "staff"; canDecide?: boolean; seeRefunds?: boolean; refund?: RefundInfo; notices?: React.ReactNode }) {
  const changes = app.amendments.filter((a) => a.source === "CLIENT");
  const openRefund = app.refunds.find((r) => OPEN_STATES.includes(r.state));
  const showRefunds = mode === "client" || seeRefunds;
  if (mode === "staff" && !changes.length && !(seeRefunds && app.refunds.length)) return null;
  return (
    <section className="card p-6" aria-labelledby="rq-h">
      <h2 id="rq-h" className="text-xl">{mode === "client" ? "Refunds and changes" : "Change requests and refunds"}</h2>
      {notices}

      {changes.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {changes.map((a) => (
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
        <ul className="mt-3 divide-y divide-line" aria-label="Refund and reapplication requests">
          {app.refunds.map((r) => (
            <li key={r.id} className="py-3" data-testid="refund-row">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{KIND_LABEL[r.kind]} {r.reference}{r.invoice ? ` · ${r.invoice.number}` : ""}</p><p className="text-sm muted">Submitted {date(r.createdAt)}{r.source === "PAPER" ? " (paper form)" : ""}{r.amountRequested ? ` · ${money(r.amountRequested, r.currency ?? "USD")} asked` : ""}{r.paidAmount ? ` · ${money(r.paidAmount, r.currency ?? "USD")} paid ${date(r.paidAt)}` : ""}</p></div>
                <span className={`badge ${STATE_BADGE[r.state]?.[1] ?? "bg-mist"}`}>{STATE_BADGE[r.state]?.[0] ?? r.state}</span>
              </div>
              <RefundTrack r={r} />
              {r.adminNote && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Decision:</span> {r.adminNote}</p>}
              {mode === "staff" && <Link href="/staff/refunds" className="mt-1 inline-block text-sm font-semibold text-brand underline">Open in Refunds</Link>}
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
          {refund && (
            <details className="rounded-xl bg-mist p-4 lg:col-span-2" id="refund-form">
              <summary className="cursor-pointer font-semibold text-brand">Request a refund or reapply</summary>
              <p className="mt-2 text-sm" data-testid="refund-eligibility">{refund.elig.text}</p>
              <p className="mt-1 text-sm muted">{refund.terms} <a className="font-semibold text-brand underline" href="/forms/refund">Download the paper form (PDF)</a></p>
              {openRefund ? <p className="mt-3 text-sm font-semibold">Request {openRefund.reference} is in progress. You can send another one when it&apos;s finished.</p>
                : (refund.refundOpen || refund.allowReapplication) ? <div className="mt-3"><RefundForm applicationId={app.id} invoices={app.invoices} allowReapplication={refund.allowReapplication} refundOpen={refund.refundOpen} mode="client" clientName={app.client.name} /></div> : null}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
