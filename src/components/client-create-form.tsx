"use client";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { createClientAccount } from "@/app/staff/clients/actions";

type Opt = { value: string; label: string; service: string };

export function ClientCreateForm({ listings, countries }: { listings: Opt[]; countries: { iso: string; name: string }[] }) {
  const [state, run, pending] = useActionState(createClientAccount, undefined);
  const [listing, setListing] = useState("");
  const [copied, setCopied] = useState(false);
  if (state?.ok) return (
    <div className="grid gap-3" role="status">
      <p className="rounded-xl bg-emerald-50 p-3 font-medium text-emerald-800">{state.ok}</p>
      <div className="rounded-xl border-2 border-gold bg-gold/10 p-4 text-sm">
        <p className="font-semibold">Activation link (valid 7 days, single use)</p>
        <p className="mt-1 break-all font-mono text-xs" data-testid="activation-link">{state.link}</p>
        <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => { navigator.clipboard?.writeText(state.link!); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
        <p className="mt-2 muted">It has also been emailed to the client when email is connected. Send it by WhatsApp or SMS if needed: the client chooses their own password with it. Nobody else ever sees their password.</p>
      </div>
      <div className="flex flex-wrap gap-2">{state.applicationId && <Link className="btn-primary btn-sm" href="/staff/available">See available clients</Link>}<a className="btn-ghost btn-sm" href="/staff/clients/new">Register another client</a></div>
    </div>
  );
  const isVisa = listing.startsWith("visa:");
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <div><label className="label" htmlFor="c-name">Full name</label><input id="c-name" name="name" className="input" required maxLength={120} autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" required autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-phone">Phone (with country code)</label><input id="c-phone" name="phone" type="tel" className="input" required placeholder="+250 7…" autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-listing">Open an application for (optional)</label>
        <select id="c-listing" name="listing" className="input" value={listing} onChange={(e) => setListing(e.target.value)}>
          <option value="">No application yet</option>
          {["WORK", "STUDY", "VISA"].map((sv) => { const g = listings.filter((l) => l.service === sv); return g.length ? <optgroup key={sv} label={sv === "WORK" ? "Work Abroad" : sv === "STUDY" ? "Study Abroad" : "Visa Processing"}>{g.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</optgroup> : null; })}
        </select></div>
      {isVisa && <>
        <div><label className="label" htmlFor="c-nat">Passport country</label><select id="c-nat" name="nat" className="input" defaultValue="RW">{countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="c-res">Country of residence</label><select id="c-res" name="res" className="input" defaultValue="RW">{countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
      </>}
      <div className="sm:col-span-2"><label className="label" htmlFor="c-note">Notes for the application (optional)</label><textarea id="c-note" name="note" rows={3} className="input" maxLength={2000} /></div>
      {state?.error && <p role="alert" className="font-medium text-red-700 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create client account"}</button></div>
    </form>
  );
}
