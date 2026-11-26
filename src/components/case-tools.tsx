// Staff-only controls for one application. Server component: it renders forms bound to server actions.
import { reviewDocument, requestDocument, updateProgress, postUpdate } from "@/app/staff/case-actions";
import { STAGES, STAGE_LABEL } from "@/lib/format";
import { ActionForm } from "./action-form";

export function ReviewControls({ applicationId, itemId, label }: { applicationId: string; itemId: string; label: string }) {
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-line bg-mist/60 p-3 sm:grid-cols-[auto_1fr]">
      <ActionForm action={reviewDocument} submit={`Verify ${label}`} pendingLabel="Verifying…" className="grid content-start gap-2" buttonClass="btn-primary btn-sm">
        <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="decision" value="verify" />
      </ActionForm>
      <ActionForm action={reviewDocument} submit="Reject" pendingLabel="Rejecting…" className="flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm">
        <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="decision" value="reject" />
        <label className="sr-only" htmlFor={`r-${itemId}`}>Reason for rejecting {label}</label>
        <input id={`r-${itemId}`} name="reason" className="input min-h-9 flex-1 py-1.5 text-sm" placeholder="Reason, shown to the client (e.g. photo is blurred)" maxLength={500} />
      </ActionForm>
    </div>
  );
}

export function RequestDocumentForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={requestDocument} submit="Request from client" pendingLabel="Requesting…">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div><label className="label" htmlFor="rq-label">Document needed</label><input id="rq-label" name="label" className="input" placeholder="e.g. Police clearance certificate" required maxLength={150} /></div>
      <div><label className="label" htmlFor="rq-note">Instructions for the client (optional)</label><input id="rq-note" name="note" className="input" placeholder="e.g. Issued in the last 6 months" maxLength={500} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mandatory" defaultChecked className="size-4 accent-brand" /> Required</label>
    </ActionForm>
  );
}

export function ProgressForm({ applicationId, stage, status }: { applicationId: string; stage: string; status: string }) {
  return (
    <ActionForm action={updateProgress} submit="Save progress" resetOnSuccess={false}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="pg-stage">Stage</label><select id="pg-stage" name="stage" className="input" defaultValue={stage}>{STAGES.map((st) => <option key={st} value={st}>{STAGE_LABEL[st]}</option>)}</select></div>
        <div><label className="label" htmlFor="pg-status">Status</label><select id="pg-status" name="status" className="input" defaultValue={status}>
          <option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="NOT_ELIGIBLE">Not eligible</option><option value="UNSUCCESSFUL">Unsuccessful</option><option value="WITHDRAWN">Withdrawn</option></select></div>
      </div>
      <div><label className="label" htmlFor="pg-msg">Message to the client (needed when closing as not eligible, unsuccessful or withdrawn)</label><textarea id="pg-msg" name="message" rows={3} className="input" maxLength={2000} /></div>
    </ActionForm>
  );
}

export function UpdateForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={postUpdate} submit="Post" pendingLabel="Posting…">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div><label className="label" htmlFor="up-body">Message</label><textarea id="up-body" name="body" rows={3} className="input" required maxLength={4000} /></div>
      <fieldset className="flex flex-wrap gap-4 text-sm"><legend className="sr-only">Who can see this</legend>
        <label className="flex items-center gap-2"><input type="radio" name="visibility" value="CLIENT" defaultChecked className="accent-brand" /> Update for the client</label>
        <label className="flex items-center gap-2"><input type="radio" name="visibility" value="INTERNAL" className="accent-brand" /> Internal note (staff only)</label>
      </fieldset>
    </ActionForm>
  );
}
