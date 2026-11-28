// Staff view of a completed application: completion date, when refund and reapplication open, Admin correction.
import { correctCompletionDate } from "@/app/staff/case-actions";
import type { FullApplication } from "@/lib/applications";
import { afterCompletion } from "@/lib/refund-policy";
import type { RefundPolicy } from "@/lib/settings";
import { date } from "@/lib/format";
import { ActionForm } from "./action-form";

export function CompletionBox({ app, policy, admin }: { app: FullApplication; policy: RefundPolicy; admin: boolean }) {
  if (app.status !== "COMPLETED") return null;
  const c = app.completedAt;
  const r = c ? afterCompletion(c, policy.refundAfterCompletionDays) : null, p = c ? afterCompletion(c, policy.reapplyAfterCompletionDays) : null;
  return (
    <section className="card p-6" aria-labelledby="cb-h" id="completion">
      <h2 id="cb-h" className="text-xl">Completion</h2>
      <p className="mt-1 text-sm">Completed on <strong data-testid="completed-on">{c ? date(c) : "not recorded"}</strong>.{r && p && <> Refund opens <strong>{date(r.opensOn)}</strong> ({policy.refundAfterCompletionDays} days); reapplication opens <strong>{date(p.opensOn)}</strong> ({policy.reapplyAfterCompletionDays} days).</>}</p>
      {admin && (
        <details className="mt-3 rounded-xl bg-mist p-4"><summary className="cursor-pointer font-semibold text-brand">Correct the completion date</summary>
          <ActionForm action={correctCompletionDate} submit="Save corrected date" className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <div><label className="label" htmlFor="cd-d">Real completion date</label><input id="cd-d" name="completedOn" type="date" required className="input" /></div>
            <div><label className="label" htmlFor="cd-r">Reason</label><input id="cd-r" name="reason" required className="input" maxLength={300} /></div>
            <p className="text-xs muted sm:col-span-2">Refund and reapplication dates are recalculated from it. The change is recorded in the activity log and the client is told.</p>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
