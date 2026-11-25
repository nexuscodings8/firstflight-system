"use client";
import { useActionState } from "react";
import { submitApplication } from "@/app/apply/actions";

export function ApplyForm({ hidden }: { hidden: Record<string, string> }) {
  const [state, action, pending] = useActionState(submitApplication, undefined);
  return (
    <form action={action} className="grid gap-4">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{state.error}</p>}
      <div><label className="label" htmlFor="note">Anything your consultant should know? (optional)</label><textarea className="input min-h-28" id="note" name="note" maxLength={2000} /></div>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1 size-5 accent-brand" /> I confirm the information I provide is correct, and FIRST FLIGHT may contact me about this application.</label>
      <button className="btn-gold" disabled={pending}>{pending ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}
