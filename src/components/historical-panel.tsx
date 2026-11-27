// Payments an existing client made before the platform, and Finance's validation of each one.
import { decideHistoricalPayment } from "@/app/staff/finance/historical-actions";
import type { FullApplication } from "@/lib/applications";
import type { FeePlan } from "@/lib/fees";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { ActionForm } from "./action-form";

export function HistoricalPanel({ app, finance }: { app: FullApplication; finance: boolean }) {
  if (app.origin !== "EXISTING") return null;
  const plan = app.feePlan as FeePlan | null;
  const rows = (plan?.installments ?? []).map((r, i) => ({ r, i })).filter(({ r }) => r.historical);
  const ev = new Map(app.caseFiles.map((f) => [f.id, f]));
  return (
    <section id="historical" className="card p-6" aria-labelledby="hist-h">
      <h2 id="hist-h" className="text-xl">Existing client: history from before the platform</h2>
      <p className="mt-1 text-sm muted">Registered at {app.stage.replace(/_/g, " ").toLowerCase()}{app.importedStageReachedAt ? `, reached on ${date(app.importedStageReachedAt)}` : ""}{app.originalStartDate ? `; service began ${date(app.originalStartDate)}` : ""}.{app.importNote ? ` ${app.importNote}` : ""}</p>
      {finance ? (
        <>
          <h3 className="mt-4 text-base">Previous payments</h3>
          {!app.historicalPayments.length && <p className="text-sm muted">None recorded.</p>}
          <ul className="mt-2 grid gap-3">
            {app.historicalPayments.map((h) => (
              <li key={h.id} className="rounded-xl border border-line p-3" data-testid="historical-payment">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold">{money(h.amount, h.currency)} · {PAYMENT_METHOD_LABEL[h.method]} · {h.reference} · paid {date(h.paidAt)}</p>
                  <span className={`badge ${h.status === "VALIDATED" ? "bg-emerald-50 text-emerald-700" : h.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{h.status === "PENDING" ? "Waiting for validation" : h.status === "VALIDATED" ? "Validated" : "Rejected"}</span>
                </div>
                {h.evidenceFileId && ev.get(h.evidenceFileId) && <a className="text-sm font-semibold text-brand underline" href={`/staff/viewer/case/${h.evidenceFileId}`}>View evidence</a>}
                {h.decisionNote && <p className="text-sm">{h.decisionNote}</p>}
                {h.status === "PENDING" && (rows.length ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <ActionForm action={decideHistoricalPayment} submit="Validate payment" className="flex flex-wrap items-end gap-2" buttonClass="btn-primary btn-sm">
                      <input type="hidden" name="id" value={h.id} /><input type="hidden" name="decision" value="validate" />
                      <div><label className="label" htmlFor={`hi-${h.id}`}>Counts towards</label><select id={`hi-${h.id}`} name="instalment" className="input min-h-9 py-1 text-sm">{rows.map(({ r, i }) => <option key={i} value={i}>Instalment {i + 1}: {r.label} ({money(r.amount, plan!.currency)})</option>)}</select></div>
                    </ActionForm>
                    <ActionForm action={decideHistoricalPayment} submit="Reject" className="flex flex-wrap items-end gap-2" buttonClass="btn-ghost btn-sm">
                      <input type="hidden" name="id" value={h.id} /><input type="hidden" name="decision" value="reject" />
                      <div className="flex-1"><label className="label" htmlFor={`hr-${h.id}`}>Reason</label><input id={`hr-${h.id}`} name="note" className="input min-h-9 py-1 text-sm" /></div>
                    </ActionForm>
                  </div>
                ) : <p className="mt-2 text-sm">Confirm the instalment schedule first and tick <strong>Paid before the platform</strong> on the instalments these payments cover.</p>)}
              </li>
            ))}
          </ul>
        </>
      ) : <p className="mt-2 text-sm">{app.historicalPayments.length} previous payment(s) recorded; Finance validates them before they count.</p>}
    </section>
  );
}
