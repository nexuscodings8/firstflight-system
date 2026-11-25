"use client";
import { useActionState } from "react";
import { submitEnquiry } from "@/app/enquire/actions";

export function EnquiryForm({ type, context, user, placeholder }: { type: string; context: unknown; user?: { name: string; email: string } | null; placeholder?: string }) {
  const [state, action, pending] = useActionState(submitEnquiry, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="context" value={JSON.stringify(context ?? null)} />
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 sm:col-span-2">{state.error}</p>}
      <div><label className="label" htmlFor="name">Your name</label><input className="input" id="name" name="name" required autoComplete="name" defaultValue={user?.name} /></div>
      <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" defaultValue={user?.email} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="phone">Phone or WhatsApp (optional)</label><input className="input" id="phone" name="phone" type="tel" autoComplete="tel" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="message">Your message</label><textarea className="input min-h-32" id="message" name="message" required placeholder={placeholder} /></div>
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send to a consultant"}</button></div>
    </form>
  );
}
