"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { flash } from "./flash";

type State = { ok?: string; error?: string } | undefined;

/** A form bound to a server action that returns { ok } or { error }. Resets its fields after success. */
export function ActionForm({ action, children, className = "grid gap-3", submit, pendingLabel = "Saving…", resetOnSuccess = true, buttonClass = "btn-primary btn-sm justify-self-start" }: {
  action: (s: State, fd: FormData) => Promise<State>;
  children: React.ReactNode; className?: string; submit: string; pendingLabel?: string; resetOnSuccess?: boolean; buttonClass?: string;
}) {
  const lastOk = useRef<{ text: string; at: number } | null>(null);
  const [state, run, pending] = useActionState(async (st: State, fd: FormData) => {
    const r = await action(st, fd);
    if (r?.ok) lastOk.current = { text: r.ok, at: Date.now() };
    return r;
  }, undefined);
  const ref = useRef<HTMLFormElement>(null);
  // When a success makes this form disappear (e.g. an approved request leaves the list), its message would be
  // lost with it, so it's shown as a toast instead.
  useEffect(() => () => { const l = lastOk.current; if (l && Date.now() - l.at < 5000) flash(l.text); }, []);
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
