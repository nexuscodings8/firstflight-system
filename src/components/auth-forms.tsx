"use client";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/(auth)/actions";

function Err({ s }: { s: FormState }) {
  return s?.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{s.error}</p> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Err s={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} /></div>
      <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Err s={state} /></div>
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="sm:col-span-2"><label className="label" htmlFor="name">Full name</label><input className="input" id="name" name="name" autoComplete="name" required defaultValue={state?.fields?.name} /></div>
      <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} /></div>
      <div><label className="label" htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" type="tel" autoComplete="tel" required defaultValue={state?.fields?.phone} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><p className="mt-1 text-xs muted">At least 8 characters.</p></div>
      <div className="sm:col-span-2"><button className="btn-gold w-full" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</button></div>
    </form>
  );
}
