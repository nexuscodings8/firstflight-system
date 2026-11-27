// Formal contract amendments on one application (staff-drafted): drafting, review and the client's signature.
import { createAmendment, reviewAmendment, signAmendment } from "@/app/amendment-actions";
import type { FullApplication } from "@/lib/applications";
import { AMEND_STATE } from "@/lib/amendments";
import { AMENDMENT_KINDS } from "@/lib/requests";
import type { FeePlan } from "@/lib/fees";
import { date, money } from "@/lib/format";
import { ActionForm } from "./action-form";

export function AmendmentsSection({ app, mode, canWork = false, role, seeMoney }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean; role?: string; seeMoney: boolean }) {
  const list = app.amendments.filter((a) => a.source === "STAFF" && (mode === "staff" || a.state === "AWAITING_SIGNATURE" || a.state === "SIGNED"));
  const hasContract = app.contracts.some((c) => c.kind === "CONTRACT");
  const open = list.some((a) => a.state && !["SIGNED", "REJECTED"].includes(a.state));
  const plan = app.feePlan as FeePlan | null;
  const cur = plan?.currency ?? app.invoices[0]?.currency ?? "USD";
  if (!list.length && !(mode === "staff" && canWork && hasContract && app.status === "ACTIVE")) return null;
  return (
    <div className="mt-5 border-t border-line pt-4" id="amendments">
      <h3 className="text-base">Contract amendments</h3>
      <ul className="mt-2 space-y-3">
        {list.map((a) => {
          const [t, cls] = AMEND_STATE[a.state ?? ""] ?? [a.state, "bg-mist"];
          return (
            <li key={a.id} className="rounded-xl border border-line p-4" data-testid="amendment">
              <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{AMENDMENT_KINDS[a.kind as keyof typeof AMENDMENT_KINDS] ?? a.kind}</p><span className={`badge ${cls}`}>{t}</span></div>
              <p className="mt-1 whitespace-pre-line text-sm">{a.details}</p>
              {a.reason && <p className="mt-1 text-sm"><span className="muted">Reason:</span> {a.reason}</p>}
              {a.newFeeAmount && (mode === "client" || seeMoney) && <p className="mt-1 text-sm font-semibold">New total service fee: {money(a.newFeeAmount, cur)}{plan ? <span className="font-normal muted"> (was {money(plan.amount, plan.currency)})</span> : null}</p>}
              {a.newFeeAmount && mode === "staff" && !seeMoney && <p className="mt-1 text-sm muted">Changes the service fee.</p>}
              {a.attachmentKey && <a className="mt-1 inline-block text-sm font-semibold text-brand underline" href={`/${mode === "client" ? "portal" : "staff"}/viewer/amendment/${a.id}`}>View attachment</a>}
              {a.decisionNote && <p className="mt-1 text-sm"><span className="muted">Note:</span> {a.decisionNote}</p>}
              <p className="mt-1 text-xs muted">Drafted {date(a.createdAt)}{a.approvedAt ? ` · approved ${date(a.approvedAt)}` : ""}</p>
              {mode === "staff" && ((a.state === "PENDING_FINANCE" && (role === "FINANCE" || role === "ADMIN")) || (a.state === "PENDING_APPROVAL" && role === "ADMIN")) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(["approve", "reject"] as const).map((d) => (
                    <ActionForm key={d} action={reviewAmendment} submit={d === "approve" ? (a.state === "PENDING_FINANCE" ? "Confirm fee change" : "Approve amendment") : "Reject"} className="grid gap-2" buttonClass={d === "approve" ? "btn-primary btn-sm justify-self-start" : "btn-ghost btn-sm justify-self-start"}>
                      <input type="hidden" name="amendmentId" value={a.id} /><input type="hidden" name="decision" value={d} />
                      <input name="note" className="input text-sm" aria-label={d === "approve" ? "Note (optional)" : "Reason"} placeholder={d === "approve" ? "Note (optional)" : "Reason"} />
                    </ActionForm>
                  ))}
                </div>
              )}
              {mode === "client" && a.state === "AWAITING_SIGNATURE" && (
                <ActionForm action={signAmendment} submit="Sign the amendment" className="mt-3 grid gap-2" buttonClass="btn-gold btn-sm justify-self-start">
                  <input type="hidden" name="amendmentId" value={a.id} />
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-1" /> I have read this amendment and I accept it.</label>
                  <label className="grid gap-1 text-sm"><span className="font-semibold">Type your full name to sign</span><input name="signedName" className="input" placeholder={app.client.name} required /></label>
                </ActionForm>
              )}
            </li>
          );
        })}
      </ul>
      {mode === "staff" && canWork && hasContract && app.status === "ACTIVE" && !open && (
        <details className="mt-3 rounded-xl bg-mist p-4">
          <summary className="cursor-pointer font-semibold text-brand">Draft a contract amendment</summary>
          <ActionForm action={createAmendment} submit="Send for approval" className="mt-3 grid gap-3">
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="grid gap-1 text-sm"><span className="font-semibold">What it changes</span><select name="kind" className="input" defaultValue="OTHER">{Object.entries(AMENDMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Amended terms (the client signs this text)</span><textarea name="details" rows={4} className="input" required /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Reason</span><input name="reason" className="input" required /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">New total service fee (optional, {cur})</span><input name="newFee" inputMode="decimal" className="input" placeholder="Leave empty if the fee doesn't change" /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Attachment (optional: PDF, JPG or PNG)</span><input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png" className="input" /></label>
            <p className="text-xs muted">A fee change needs Finance to confirm it. Every amendment needs an administrator&apos;s approval, then the client&apos;s signature.</p>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
