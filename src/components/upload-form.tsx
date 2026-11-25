"use client";
import { useActionState, useRef } from "react";
import { uploadDocument } from "@/app/portal/actions";

export function UploadForm({ applicationId, itemId, label }: { applicationId: string; itemId: string; label: string }) {
  const [state, action, pending] = useActionState(uploadDocument, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const id = `f-${itemId}`;
  return (
    <form ref={ref} action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="checklistItemId" value={itemId} />
      <label htmlFor={id} className="sr-only">Choose a file for {label}</label>
      <input id={id} name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-semibold file:text-brand" />
      <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      {state?.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
