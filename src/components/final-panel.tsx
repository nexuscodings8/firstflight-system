// Final collection: the client's choice (visit the office / continue remotely) and the documents the consultant
// shares, with categories, statuses and version history.
import { chooseFinalCollection, requestDocumentCorrection, shareFinalDocument, uploadFinalDocument } from "@/app/final-actions";
import type { FullApplication } from "@/lib/applications";
import { FINAL_CATEGORIES, FINAL_STATUS } from "@/lib/final-collection";
import { dateTime } from "@/lib/format";
import { ActionForm } from "./action-form";

type F = FullApplication["caseFiles"][number];

function UploadForm({ app, replaces }: { app: FullApplication; replaces?: F }) {
  return (
    <ActionForm action={uploadFinalDocument} submit={replaces ? "Upload new version" : "Upload document"} className="mt-3 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="applicationId" value={app.id} />
      {replaces && <input type="hidden" name="replacesId" value={replaces.id} />}
      <div><label className="label" htmlFor={`ft-${replaces?.id ?? app.id}`}>Document title</label><input id={`ft-${replaces?.id ?? app.id}`} name="title" required defaultValue={replaces?.title} className="input" maxLength={150} /></div>
      <div><label className="label" htmlFor={`fc-${replaces?.id ?? app.id}`}>Category</label><select id={`fc-${replaces?.id ?? app.id}`} name="category" defaultValue={replaces?.category ?? "SCAN"} className="input">{Object.entries(FINAL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={`fd-${replaces?.id ?? app.id}`}>Description or instructions for the client</label><textarea id={`fd-${replaces?.id ?? app.id}`} name="description" rows={2} defaultValue={replaces?.note ?? ""} className="input" maxLength={1000} /></div>
      <div><label className="label" htmlFor={`ff-${replaces?.id ?? app.id}`}>File (PDF, JPG or PNG)</label><input id={`ff-${replaces?.id ?? app.id}`} name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className="input" /></div>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="share" defaultChecked /> Share with the client now (they&apos;re notified)</label>
    </ActionForm>
  );
}

export function FinalPanel({ app, mode, canWork = false, notices }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean; notices?: React.ReactNode }) {
  const at = app.stage === "FINAL_COLLECTION";
  const all = app.caseFiles.filter((f) => f.kind === "FINAL_DOC");
  const visible = mode === "client" ? all.filter((f) => f.status !== "UPLOADED") : all;
  const current = visible.filter((f) => !f.supersededAt).sort((a, b) => +b.createdAt - +a.createdAt);
  const older = (f: F): F[] => { const prev = all.find((x) => x.id === f.replacesId); return prev ? [prev, ...older(prev)] : []; };
  if (!at && !visible.length) return null;
  const area = mode === "client" ? "portal" : "staff";
  return (
    <section id="final" className="card p-6" aria-labelledby="fin-h">
      <h2 id="fin-h" className="text-xl">Final collection</h2>
      {notices}
      {at && mode === "client" && app.status === "ACTIVE" && (
        <div className="mt-3">
          <p className="text-sm">How would you like to complete this last step?{app.finalCollectionMode ? <> Your choice: <strong data-testid="final-choice">{app.finalCollectionMode === "REMOTE" ? "Continue remotely" : "Visit the office"}</strong> ({dateTime(app.finalCollectionChosenAt!)}).</> : null}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["OFFICE", "REMOTE"] as const).map((m) => (
              <ActionForm key={m} action={chooseFinalCollection} submit={m === "OFFICE" ? "Visit the office" : "Continue remotely"} buttonClass={app.finalCollectionMode === m ? "btn-primary w-full" : "btn-ghost w-full"} className="grid">
                <input type="hidden" name="applicationId" value={app.id} /><input type="hidden" name="mode" value={m} />
              </ActionForm>
            ))}
          </div>
          <p className="mt-1 text-xs muted">Continue remotely: your consultant shares your documents and forms here, so you only come to the office if it&apos;s really needed.</p>
        </div>
      )}
      {mode === "staff" && <p className="mt-2 text-sm">Client&apos;s choice: <strong data-testid="final-choice">{app.finalCollectionMode === "REMOTE" ? "Continue remotely" : app.finalCollectionMode === "OFFICE" ? "Visit the office" : "not chosen yet"}</strong>{app.finalCollectionChosenAt ? ` (${dateTime(app.finalCollectionChosenAt)})` : ""}</p>}
      <h3 className="mt-4 text-base">Documents</h3>
      {!current.length && <p className="text-sm muted">{mode === "client" ? "Your consultant will share your documents here." : "No documents yet."}</p>}
      <ul className="mt-2 grid gap-3">
        {current.map((f) => {
          const [txt, cls] = FINAL_STATUS[f.status ?? "AVAILABLE"] ?? ["", ""];
          const hist = older(f);
          return (
            <li key={f.id} className="rounded-xl border border-line p-4" data-testid="final-doc">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{f.title}</p><p className="text-sm muted">{FINAL_CATEGORIES[f.category ?? "OTHER"]} · uploaded {dateTime(f.createdAt)}{mode === "staff" ? ` by ${f.uploadedBy.name}` : ""}</p></div>
                <span className={`badge ${cls}`} data-testid="final-doc-status">{txt}</span>
              </div>
              {f.note && <p className="mt-1 text-sm">{f.note}</p>}
              {f.status === "CORRECTION_REQUIRED" && f.correctionNote && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm"><strong>Correction asked:</strong> {f.correctionNote}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <a className="btn-primary btn-sm" href={`/${area}/viewer/case/${f.id}`}>Preview</a>
                <a className="btn-ghost btn-sm" href={`/api/files/case/${f.id}`}>Download</a>
              </div>
              {mode === "client" && f.status !== "CORRECTION_REQUIRED" && (
                <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand underline">Something wrong with this document?</summary>
                  <ActionForm action={requestDocumentCorrection} submit="Ask for a correction" buttonClass="btn-ghost btn-sm justify-self-start" className="mt-2 grid gap-2">
                    <input type="hidden" name="fileId" value={f.id} /><label className="sr-only" htmlFor={`cr-${f.id}`}>What needs correcting</label><input id={`cr-${f.id}`} name="note" className="input" placeholder="What needs correcting" />
                  </ActionForm>
                </details>
              )}
              {mode === "staff" && canWork && (
                <div className="mt-2 flex flex-wrap items-start gap-3">
                  {f.status === "UPLOADED" && <ActionForm action={shareFinalDocument} submit="Share with the client" className="grid"><input type="hidden" name="applicationId" value={app.id} /><input type="hidden" name="fileId" value={f.id} /></ActionForm>}
                  <details className="flex-1 text-sm"><summary className="cursor-pointer font-semibold text-brand">Replace or update</summary><UploadForm app={app} replaces={f} /></details>
                </div>
              )}
              {hist.length > 0 && (
                <details className="mt-2 text-sm"><summary className="cursor-pointer muted">Earlier versions ({hist.length})</summary>
                  <ul className="mt-1 divide-y divide-line">{hist.map((h) => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span>{h.title} · {dateTime(h.createdAt)}{mode === "staff" ? ` by ${h.uploadedBy.name}` : ""}{h.correctionNote ? ` · correction asked: ${h.correctionNote}` : ""}</span><a className="text-brand underline" href={`/${area}/viewer/case/${h.id}`}>Open</a></li>)}</ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {mode === "staff" && canWork && (at || app.stage === "COMPLETED") && (
        current.length
          ? <details className="mt-4 rounded-xl bg-mist p-4"><summary className="cursor-pointer font-semibold text-brand">Upload a document for the client</summary><UploadForm app={app} /></details>
          : <div className="mt-4 rounded-xl bg-mist p-4"><h3 className="text-base">Upload a document for the client</h3><UploadForm app={app} /></div>
      )}
    </section>
  );
}
