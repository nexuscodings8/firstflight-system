// Offer letter and visa on one application: shown to the client and staff; uploads for the consultant or admin.
import { recordVisa, uploadOfferLetter } from "@/app/case-file-actions";
import type { FullApplication } from "@/lib/applications";
import { STAGES, STAGE_LABEL, date, dateTime } from "@/lib/format";
import { needsOffer } from "@/lib/schedule";
import { ActionForm } from "./action-form";

/** Shown open while it's the thing to do now; collapsible afterwards. */
function Box({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) {
  return open ? <div className="rounded-xl bg-mist p-4"><h3 className="text-base">{title}</h3>{children}</div>
    : <details className="rounded-xl bg-mist p-4"><summary className="cursor-pointer font-semibold text-brand">{title}</summary>{children}</details>;
}
const at = (st: string) => STAGES.indexOf(st as (typeof STAGES)[number]);

export function OfferPanel({ app, mode, canWork = false }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean }) {
  const offer = app.caseFiles.filter((f) => f.kind === "OFFER_LETTER");
  const visa = app.caseFiles.filter((f) => f.kind === "VISA");
  const earlier = app.caseFiles.filter((f) => f.kind === "OTHER");
  const area = mode === "client" ? "portal" : "staff";
  const offerStage = at(app.stage) >= at("GETTING_OFFER"), visaStage = at(app.stage) >= at("VISA_PROCESSING");
  if (!offer.length && !visa.length && !earlier.length && (mode === "client" || !offerStage)) return null;
  const FileRow = ({ f }: { f: FullApplication["caseFiles"][number] }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="case-file">
      <div><p className="font-semibold">{f.title}{f.historical ? <span className="ml-2 text-xs muted">from before the platform</span> : null}</p>
        <p className="text-sm muted">Uploaded {dateTime(f.createdAt)}{mode === "staff" ? ` by ${f.uploadedBy.name}` : ""}{f.issuedOn ? ` · dated ${date(f.issuedOn)}` : ""}{mode === "staff" && f.clientViewedAt ? ` · client opened it ${date(f.clientViewedAt)}` : ""}</p>
        {mode === "staff" && f.note && <p className="text-sm">{f.note}</p>}</div>
      <div className="flex gap-2"><a className="btn-primary btn-sm" href={`/${area}/viewer/case/${f.id}`}>Open</a><a className="btn-ghost btn-sm" href={`/api/files/case/${f.id}`}>Download</a></div>
    </li>
  );
  return (
    <section id="offer" className="card p-6" aria-labelledby="of-h">
      <h2 id="of-h" className="text-xl">{needsOffer(app.service) ? "Offer letter, visa and documents" : "Visa and documents"}</h2>
      <p className="mt-1 text-sm muted">Current stage: {STAGE_LABEL[app.stage]}</p>
      {offer.length + visa.length > 0 && <ul className="mt-2 divide-y divide-line">{[...offer, ...visa].map((f) => <FileRow key={f.id} f={f} />)}</ul>}
      {earlier.length > 0 && <><h3 className="mt-4 text-base">Earlier documents (from before the platform)</h3><ul className="divide-y divide-line">{earlier.map((f) => <FileRow key={f.id} f={f} />)}</ul></>}
      {mode === "staff" && needsOffer(app.service) && offerStage && !offer.length && <p className="mt-2 text-sm">No offer letter yet. Instalments payable after the offer letter are invoiced when it&apos;s uploaded.</p>}
      {mode === "staff" && canWork && app.status === "ACTIVE" && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {needsOffer(app.service) && offerStage && (
            <Box open={!offer.length && app.stage === "GETTING_OFFER"} title={offer.length ? "Upload a new version of the offer letter" : "Upload the offer letter"}>
              <ActionForm action={uploadOfferLetter} submit="Upload offer letter" className="mt-3 grid gap-2">
                <input type="hidden" name="applicationId" value={app.id} />
                <label className="grid gap-1 text-sm"><span className="font-semibold">Offer letter (PDF, JPG or PNG)</span><input type="file" name="file" required accept="application/pdf,image/jpeg,image/png" className="input" /></label>
                <label className="grid gap-1 text-sm"><span className="font-semibold">Date on the letter (optional)</span><input type="date" name="issuedOn" className="input" /></label>
                <label className="grid gap-1 text-sm"><span className="font-semibold">Description or internal note (optional)</span><input name="note" className="input" maxLength={1000} /></label>
              </ActionForm>
            </Box>
          )}
          {visaStage && (
            <Box open={!visa.length && app.stage === "VISA_PROCESSING"} title={visa.length ? "Record an updated visa" : "Record the visa"}>
              <ActionForm action={recordVisa} submit="Record visa" className="mt-3 grid gap-2">
                <input type="hidden" name="applicationId" value={app.id} />
                <label className="grid gap-1 text-sm"><span className="font-semibold">Copy of the visa (PDF, JPG or PNG)</span><input type="file" name="file" required accept="application/pdf,image/jpeg,image/png" className="input" /></label>
                <label className="grid gap-1 text-sm"><span className="font-semibold">Date issued</span><input type="date" name="issuedOn" required className="input" /></label>
                <label className="grid gap-1 text-sm"><span className="font-semibold">Note (optional)</span><input name="note" className="input" maxLength={1000} /></label>
              </ActionForm>
            </Box>
          )}
        </div>
      )}
    </section>
  );
}
