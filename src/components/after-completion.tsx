// Completed applications: Refund and Reapplication are shown at once, each disabled until its own eligibility
// date (completion date + that option's waiting period), then enabled automatically.
import type { FullApplication } from "@/lib/applications";
import { OPTION_LABEL, afterCompletion, optionStatus, type OptionKind, type OptionStatus } from "@/lib/refund-policy";
import type { RefundPolicy } from "@/lib/settings";
import { date } from "@/lib/format";
import { firstPaymentAt } from "@/lib/refunds";
import { RefundForm } from "./refund-form";

const BADGE: Record<OptionStatus, string> = { WAITING: "bg-slate-100 text-slate-700", AVAILABLE: "bg-emerald-50 text-emerald-700", SUBMITTED: "bg-blue-50 text-brand", UNDER_REVIEW: "bg-amber-50 text-amber-800", APPROVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700", BLOCKED: "bg-slate-100 text-slate-700" };

export function AfterCompletion({ app, policy, now = new Date(), notices }: { app: FullApplication; policy: RefundPolicy; now?: Date; notices?: React.ReactNode }) {
  if (app.status !== "COMPLETED" || !app.completedAt) return null;
  const completedAt = app.completedAt;
  const paid = !!firstPaymentAt(app.invoices);
  const opts: { kind: OptionKind; title: string; days: number; offered: boolean; why?: string }[] = [
    { kind: "REFUND", title: "Refund request", days: policy.refundAfterCompletionDays, offered: paid, why: "Refunds apply to approved payments; there's none on this application." },
    { kind: "REAPPLICATION", title: "Reapplication", days: policy.reapplyAfterCompletionDays, offered: policy.allowReapplication, why: "Reapplication isn't offered for this service." },
  ];
  return (
    <section id="after-completion" className="card p-6" aria-labelledby="ac-h">
      <h2 id="ac-h" className="text-xl">Refund and reapplication</h2>
      {notices}
      <p className="mt-1 text-sm muted">Your application was completed on {date(completedAt)}. Each option opens on its own date under this service&apos;s policy. {policy.terms}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {opts.map((o) => {
          const w = afterCompletion(completedAt, o.days, now);
          const st = optionStatus(o.kind, completedAt, w, app.refunds);
          const canSubmit = st.canSubmit && o.offered;
          return (
            <div key={o.kind} className="rounded-2xl border border-line p-4" data-testid={`option-${o.kind.toLowerCase()}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-lg">{o.title}</h3>
                <span className={`badge ${BADGE[st.status]}`} data-testid="option-status">{OPTION_LABEL[st.status]}</span>
              </div>
              <p className="mt-1 text-sm">{w.state === "WAITING" ? <>Available on <strong>{date(w.opensOn)}</strong>. You can submit this request in <strong>{w.daysLeft} day{w.daysLeft === 1 ? "" : "s"}</strong>.</> : <>Available since {date(w.opensOn)}.</>}</p>
              {!o.offered && <p className="mt-1 text-sm muted">{o.why}</p>}
              {canSubmit ? (
                <details className="mt-3 rounded-xl bg-mist p-3">
                  <summary className="cursor-pointer font-semibold text-brand">{o.kind === "REFUND" ? "Request a refund" : "Request reapplication"}</summary>
                  <div className="mt-3"><RefundForm applicationId={app.id} invoices={app.invoices} allowReapplication refundOpen mode="client" clientName={app.client.name} fixedKind={o.kind} /></div>
                </details>
              ) : (
                <button type="button" disabled aria-disabled="true" className="btn-primary btn-sm mt-3 cursor-not-allowed opacity-50">{o.kind === "REFUND" ? "Request a refund" : "Request reapplication"}</button>
              )}
              {st.status !== "WAITING" && st.status !== "AVAILABLE" && <p className="mt-2 text-xs muted">Follow every step under Refund requests.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
