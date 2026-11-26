"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import type { UserState } from "@/app/staff/users/actions";

/** Like ActionForm, but shows a one-time temporary password to hand to the person. */
export function UserActionForm({ action, children, submit, className = "grid gap-3", buttonClass = "btn-primary btn-sm justify-self-start", resetOnSuccess = true }: {
  action: (s: UserState, fd: FormData) => Promise<UserState>; children: React.ReactNode; submit: string; className?: string; buttonClass?: string; resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      <button className={buttonClass} disabled={pending}>{pending ? "Working…" : submit}</button>
      {state?.error && <p role="alert" className="w-full text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm font-medium text-emerald-700">{state.ok}</p>}
      {state?.tempPassword && (
        <div className="w-full rounded-xl border-2 border-gold bg-gold/10 p-3 text-sm">
          <p className="font-semibold">Temporary password for {state.forEmail}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2"><code data-testid="temp-password" className="rounded-lg bg-white px-2 py-1 font-mono text-base">{state.tempPassword}</code>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(state.tempPassword!); setCopiedFor(state.tempPassword!); }}>{copiedFor === state.tempPassword ? "Copied" : "Copy"}</button></p>
          <p className="mt-1 text-xs muted">Give it to them in person or by phone. It is shown only now; they will choose their own password when they first sign in.</p>
        </div>
      )}
    </form>
  );
}
