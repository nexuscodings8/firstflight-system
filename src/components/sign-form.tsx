"use client";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { signContract } from "@/app/contract-actions";

export function SignForm({ applicationId, templateId, clientName }: { applicationId: string; templateId: string; clientName: string }) {
  const [state, run, pending] = useActionState(signContract, undefined);
  if (state?.ok) return (
    <div role="status" className="rounded-2xl bg-emerald-50 p-5 text-emerald-900">
      <p className="font-semibold">{state.ok}</p>
      <Link href={`/portal/applications/${applicationId}#contract`} className="btn-primary btn-sm mt-3">Back to my application</Link>
    </div>
  );
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="templateId" value={templateId} />
      <label className="flex items-start gap-2"><input type="checkbox" name="agree" className="mt-1" /> I have read this contract and I accept its terms.</label>
      <label className="grid gap-1"><span className="font-semibold">Type your full name to sign</span>
        <input name="signedName" autoComplete="name" className="input" placeholder={clientName} required /></label>
      <p className="text-xs muted">Your typed name, the date and time, and your IP address are recorded as your electronic signature.</p>
      <button className="btn-gold justify-self-start" disabled={pending}>{pending ? "Signing…" : "Sign the contract"}</button>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
    </form>
  );
}
