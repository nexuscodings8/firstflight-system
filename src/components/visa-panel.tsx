// Visa processing: the consultant's estimate of when the visa will be received (clearly an estimate), its
// history, and the form to set or update it.
import { setVisaEstimate } from "@/app/final-actions";
import type { FullApplication } from "@/lib/applications";
import { estimateText } from "@/lib/final-collection";
import { dateTime } from "@/lib/format";
import { ActionForm } from "./action-form";

export function VisaPanel({ app, mode, canWork = false, notices }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean; notices?: React.ReactNode }) {
  const list = app.visaEstimates;
  const latest = list[0];
  const visa = app.caseFiles.find((f) => f.kind === "VISA");
  const atStage = app.stage === "VISA_PROCESSING";
  if (!atStage && !list.length) return null;
  return (
    <section id="visa" className="card p-6" aria-labelledby="visa-h">
      <h2 id="visa-h" className="text-xl">Visa processing</h2>
      {notices}
      {visa ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Visa received and recorded on {dateTime(visa.createdAt)}.</p> : null}
      {latest ? (
        <div className="mt-3 rounded-2xl border-2 border-gold/60 bg-gold/10 p-4" data-testid="visa-estimate">
          <p className="text-xs font-semibold uppercase tracking-wide">Estimated date, not confirmed</p>
          <p className="mt-1 font-display text-xl font-extrabold">{estimateText(latest.expectedDate, latest.expectedTime)}</p>
          {latest.note && <p className="mt-1 text-sm">{latest.note}</p>}
          <p className="mt-2 text-xs muted">Last updated {dateTime(latest.createdAt)}{mode === "staff" ? ` by ${latest.setBy.name}` : ""}. This is your consultant&apos;s estimate, not a guaranteed or officially confirmed visa issue date. Your visa counts as received only when your consultant records it.</p>
        </div>
      ) : <p className="mt-2 text-sm muted">{mode === "client" ? "Your consultant will share an expected date as soon as they have one." : "No expected date set yet."}</p>}
      {list.length > 1 && (
        <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-brand">Earlier estimates ({list.length - 1})</summary>
          <ul className="mt-2 divide-y divide-line">{list.slice(1).map((e) => <li key={e.id} className="py-1.5"><span className="muted">{dateTime(e.createdAt)}:</span> {estimateText(e.expectedDate, e.expectedTime)}{e.note ? ` · ${e.note}` : ""}</li>)}</ul>
        </details>
      )}
      {mode === "staff" && canWork && atStage && app.status === "ACTIVE" && (
        <ActionForm action={setVisaEstimate} submit={latest ? "Update the expected date" : "Save the expected date"} className="mt-4 grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-3" resetOnSuccess={false}>
          <input type="hidden" name="applicationId" value={app.id} />
          <div><label className="label" htmlFor="ve-d">Expected visa receiving date</label><input id="ve-d" name="expectedDate" type="date" required defaultValue={latest?.expectedDate} className="input" /></div>
          <div><label className="label" htmlFor="ve-t">Expected time (optional)</label><input id="ve-t" name="expectedTime" type="time" defaultValue={latest?.expectedTime ?? ""} className="input" /></div>
          <div className="sm:col-span-3"><label className="label" htmlFor="ve-n">Explanation for the client (optional)</label><textarea id="ve-n" name="note" rows={2} defaultValue={latest?.note ?? ""} className="input" maxLength={1000} /></div>
          <p className="text-xs muted sm:col-span-3">The client is notified every time you change it. It&apos;s shown as an estimate and never marks the visa as received: record the visa itself below when it arrives.</p>
        </ActionForm>
      )}
    </section>
  );
}
