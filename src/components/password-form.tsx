"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { changePassword } from "@/app/account/actions";

export function PasswordForm({ required = false, home }: { required?: boolean; home: string }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  // The page re-renders without "required" once the password is saved; remember that it was.
  const [wasRequired] = useState(required);
  if (state?.ok && wasRequired) return (
    <div className="grid gap-4">
      <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">Password saved. You can now use the system.</p>
      <Link href={home} className="btn-primary">Continue</Link>
    </div>
  );
  return (
    <form action={action} className="grid gap-4">
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">Password changed. Other devices have been signed out.</p>}
      <div><label className="label" htmlFor="current">{wasRequired ? "Temporary password" : "Current password"}</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="new">New password</label><input className="input" id="new" name="new" type="password" autoComplete="new-password" minLength={10} required /><p className="mt-1 text-xs muted">At least 10 characters.</p></div>
      <div><label className="label" htmlFor="confirm">Repeat new password</label><input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
