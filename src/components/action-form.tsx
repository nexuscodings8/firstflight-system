"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";

type State = { ok?: string; error?: string } | undefined;

/** A form bound to a server action that returns { ok } or { error }. Resets its fields after success. */
export function ActionForm({ action, children, className = "grid gap-3", submit, pendingLabel = "Saving…", resetOnSuccess = true, buttonClass = "btn-primary btn-sm justify-self-start" }: {
  action: (s: State, fd: FormData) => Promise<State>;
  children: React.ReactNode; className?: string; submit: string; pendingLabel?: string; resetOnSuccess?: boolean; buttonClass?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} className={className} onSubmit={(e) => {
      // Submit without React's automatic form reset, so typed values survive a validation error.
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(() => run(fd));
    }}>
      {children}
      <button className={buttonClass} disabled={pending}>{pending ? pendingLabel : submit}</button>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm font-medium text-emerald-700">{state.ok}</p>}
    </form>
  );
}
