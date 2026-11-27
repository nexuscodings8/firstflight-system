import { dateTime } from "@/lib/format";
import type { FullApplication } from "@/lib/applications";
import { StageTracker } from "./stage-tracker";
import { BoardingPass } from "./boarding-pass";
import { UploadForm } from "./upload-form";
import { Icon } from "./icons";

const STATE: Record<string, [string, string]> = {
  PENDING: ["To upload", "bg-slate-100 text-slate-700"], REQUESTED: ["Requested by consultant", "bg-amber-50 text-amber-800"],
  UPLOADED: ["Uploaded, awaiting check", "bg-blue-50 text-brand"], VERIFIED: ["Verified", "bg-emerald-50 text-emerald-700"], REJECTED: ["Please re-upload", "bg-red-50 text-red-700"],
};

/** Shared application view. `mode` decides what is visible: clients never see internal notes. */
export function ApplicationView({ app, mode, canUpload, itemTools, checklistFooter, updatesFooter, children, stub, nextStep }: {
  app: FullApplication; mode: "client" | "staff"; canUpload: boolean;
  stub?: React.ReactNode; nextStep?: string; // boarding-pass stub content and the "Next step" callout
  itemTools?: (item: FullApplication["checklist"][number]) => React.ReactNode; // staff review controls per document
  checklistFooter?: React.ReactNode; updatesFooter?: React.ReactNode; children?: React.ReactNode; // extra sections below
}) {
  const sel = app.selection as { title: string; details: [string, string][] };
  const updates = app.updates.filter((u) => mode === "staff" || u.visibility === "CLIENT");
  const missing = app.checklist.filter((c) => c.mandatory && !["UPLOADED", "VERIFIED"].includes(c.state)).length;
  return (
    <div className="grid gap-6">
      <BoardingPass app={app} stub={stub} headingLevel="h1" />
      {sel.details.length > 0 && <dl className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">{sel.details.map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-white p-3"><dt className="text-xs muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>}
      <section className="card p-6" aria-label="Application progress"><StageTracker stage={app.stage} status={app.status} /></section>
      {nextStep && <section className="rounded-2xl border border-line border-l-4 border-l-gold bg-white p-5 shadow-sm"><h2 className="text-lg">Next step</h2><p className="mt-1">{nextStep}</p></section>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl">Document checklist</h2><p className="text-sm muted">{missing ? `${missing} required document${missing === 1 ? "" : "s"} still needed` : "All required documents received"}</p></div>
          <ul className="mt-3 divide-y divide-line">
            {app.checklist.map((c) => {
              const [t, cls] = STATE[c.state];
              return (
                <li key={c.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{c.label}{!c.mandatory && <span className="ml-2 text-xs font-normal muted">Optional</span>}</span><span className={`badge ${cls}`}>{t}</span></div>
                  {c.note && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{c.note}</p>}
                  {c.documents.length > 0 && <ul className="mt-2 space-y-1 text-sm">{c.documents.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-x-2"><a className="inline-flex items-center gap-1.5 text-brand underline" href={`/${mode === "client" ? "portal" : "staff"}/viewer/document/${d.id}`}><Icon name="file" className="size-4" />{d.fileName}</a><span className="muted">· {dateTime(d.createdAt)}</span><a className="text-xs font-semibold text-brand underline" href={`/api/documents/${d.id}`}>Download</a></li>)}</ul>}
                  {c.reviewedAt && (c.state === "VERIFIED" || c.state === "REJECTED") && <p className="mt-1 text-xs muted">{c.state === "VERIFIED" ? "Verified" : "Rejected"} by {c.reviewedBy?.name ?? "staff"} on {dateTime(c.reviewedAt)}</p>}
                  {canUpload && app.status === "ACTIVE" && c.state !== "VERIFIED" && <UploadForm applicationId={app.id} itemId={c.id} label={c.label} />}
                  {itemTools?.(c)}
                </li>
              );
            })}
          </ul>
          {!app.checklist.length && <p className="mt-3 text-sm muted">Your consultant will add the documents needed.</p>}
          {checklistFooter}
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Updates</h2>
          <ul className="mt-3 space-y-3">
            {updates.map((u) => <li key={u.id} className={`rounded-xl p-3 ${u.visibility === "INTERNAL" ? "border border-dashed border-amber-400 bg-amber-50" : "bg-mist"}`}>{u.visibility === "INTERNAL" && <p className="text-xs font-bold text-amber-800">Internal note</p>}<p>{u.body}</p><p className="mt-1 text-xs muted">{u.author.name} · {dateTime(u.createdAt)}</p></li>)}
          </ul>
          {!updates.length && <p className="mt-3 text-sm muted">No updates yet. Your consultant will post progress here.</p>}
          {updatesFooter}
        </section>
      </div>
      {children}
    </div>
  );
}
