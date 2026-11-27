"use client";
import { startTransition, useActionState } from "react";
import { activateAccount } from "@/app/activate/actions";

export function ActivateForm({ token }: { token: string }) {
  const [state, run, pending] = useActionState(activateAccount, undefined);
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">New password (10+ characters)</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
      <div><label className="label" htmlFor="confirm">Repeat password</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} /></div>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Activate and sign in"}</button>
    </form>
  );
}
