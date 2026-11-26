import { STAGE_LABEL, SERVICE_LABEL, dateTime, date, label } from "@/lib/format";
import type { FullApplication } from "@/lib/applications";
import { StageTracker } from "./stage-tracker";
import { UploadForm } from "./upload-form";
import { Icon } from "./icons";

const STATE: Record<string, [string, string]> = {
  PENDING: ["To upload", "bg-slate-100 text-slate-700"], REQUESTED: ["Requested by consultant", "bg-amber-50 text-amber-800"],
  UPLOADED: ["Uploaded, awaiting check", "bg-blue-50 text-brand"], VERIFIED: ["Verified", "bg-emerald-50 text-emerald-700"], REJECTED: ["Please re-upload", "bg-red-50 text-red-700"],
};

/** Shared application view. `mode` decides what is visible: clients never see internal notes. */
export function ApplicationView({ app, mode, canUpload, itemTools, checklistFooter, updatesFooter, children }: {
  app: FullApplication; mode: "client" | "staff"; canUpload: boolean;
  itemTools?: (item: FullApplication["checklist"][number]) => React.ReactNode; // staff review controls per document
  checklistFooter?: React.ReactNode; updatesFooter?: React.ReactNode; children?: React.ReactNode; // extra sections below
}) {
  const sel = app.selection as { title: string; details: [string, string][] };
  const updates = app.updates.filter((u) => mode === "staff" || u.visibility === "CLIENT");
  const missing = app.checklist.filter((c) => c.mandatory && !["UPLOADED", "VERIFIED"].includes(c.state)).length;
  return (
    <div className="grid gap-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{SERVICE_LABEL[app.service]} · {app.reference}</p>
            <h1 className="mt-1 text-2xl sm:text-3xl">{sel.title}</h1>
            <p className="mt-1 text-sm muted">Submitted {date(app.createdAt)} · Consultant: <strong className="text-ink">{app.consultant?.name ?? "Being assigned"}</strong></p>
          </div>
          <span className="badge bg-gold/25 text-ink">{app.status === "ACTIVE" ? STAGE_LABEL[app.stage] : label(app.status)}</span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">{sel.details.map(([k, v]) => <div key={k} className="rounded-xl bg-mist p-3"><dt className="text-xs muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
        <div className="mt-6"><StageTracker stage={app.stage} status={app.status} /></div>
      </section>

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
                  {c.documents.length > 0 && <ul className="mt-2 space-y-1 text-sm">{c.documents.map((d) => <li key={d.id}><a className="inline-flex items-center gap-1.5 text-brand underline" href={`/api/documents/${d.id}`}><Icon name="file" className="size-4" />{d.fileName}</a> <span className="muted">· {dateTime(d.createdAt)}</span></li>)}</ul>}
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
