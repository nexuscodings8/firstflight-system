"use client";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { createClientAccount } from "@/app/staff/clients/actions";

type Opt = { value: string; label: string; service: string };

const STAGE_CHOICES: [string, string][] = [["SUBMITTED", "Application submitted"], ["ELIGIBILITY_REVIEW", "Eligibility review"], ["INITIAL_PAYMENT", "Initial invoice issued"], ["DOCUMENT_SIGNING", "Payment approved, contract to sign"], ["PROCESSING", "Contract signed, processing"], ["GETTING_OFFER", "Getting offer"], ["VISA_PROCESSING", "Visa processing"], ["FINAL_COLLECTION", "Final collection"], ["COMPLETED", "Completed"]];
const fileCls = "block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-semibold file:text-brand";

export function ClientCreateForm({ listings, allListings, countries, consultants, existingDefault }: { listings: Opt[]; allListings: Opt[]; countries: { iso: string; name: string }[]; consultants: { id: string; name: string }[] | null; existingDefault: boolean }) {
  const [state, run, pending] = useActionState(createClientAccount, undefined);
  const [listing, setListing] = useState("");
  const [existing, setExisting] = useState(existingDefault);
  const [stage, setStage] = useState("PROCESSING");
  const [pays, setPays] = useState(1);
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
      <div className="flex flex-wrap gap-2">{state.applicationId && <Link className="btn-primary btn-sm" href={`/staff/applications/${state.applicationId}`}>Open the application</Link>}<a className="btn-ghost btn-sm" href="/staff/clients/new">Register another client</a></div>
    </div>
  );
  const isVisa = listing.startsWith("visa:");
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <fieldset className="sm:col-span-2"><legend className="label">Who is this?</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="new" checked={!existing} onChange={() => setExisting(false)} /> A new client (e.g. visiting the office)</label>
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="existing" checked={existing} onChange={() => setExisting(true)} /> An existing client served manually before the platform</label>
        </div>
      </fieldset>
      <div><label className="label" htmlFor="c-name">Full name</label><input id="c-name" name="name" className="input" required maxLength={120} autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" required autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-phone">Phone (with country code)</label><input id="c-phone" name="phone" type="tel" className="input" required placeholder="+250 7…" autoComplete="off" /></div>
      <div><label className="label" htmlFor="c-listing">{existing ? "Service being received" : "Open an application for (optional)"}</label>
        <select id="c-listing" name="listing" className="input" value={listing} onChange={(e) => setListing(e.target.value)} required={existing}>
          <option value="">{existing ? "Choose…" : "No application yet"}</option>
          {["WORK", "STUDY", "VISA"].map((sv) => { const g = (existing ? allListings : listings).filter((l) => l.service === sv); return g.length ? <optgroup key={sv} label={sv === "WORK" ? "Work Abroad" : sv === "STUDY" ? "Study Abroad" : "Visa Processing"}>{g.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</optgroup> : null; })}
        </select></div>
      {isVisa && <>
        <div><label className="label" htmlFor="c-nat">Passport country</label><select id="c-nat" name="nat" className="input" defaultValue="RW">{countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="c-res">Country of residence</label><select id="c-res" name="res" className="input" defaultValue="RW">{countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
      </>}
      {consultants && <div><label className="label" htmlFor="c-cons">Responsible consultant (optional)</label><select id="c-cons" name="consultantId" className="input" defaultValue=""><option value="">Leave in Available clients</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
      <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="linkExisting" className="mt-1" /> If this email already has a client account, add the application to that account and send them an access link (no duplicate account).</label>
      {existing && <>
        <h2 className="text-lg sm:col-span-2">Where the client really is</h2>
        <div><label className="label" htmlFor="c-start">Service started on (if known)</label><input id="c-start" name="startedOn" type="date" className="input" /></div>
        <div><label className="label" htmlFor="c-stage">Actual current stage</label><select id="c-stage" name="stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>{STAGE_CHOICES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="c-reached">Date this stage was reached (if known)</label><input id="c-reached" name="stageReachedOn" type="date" className="input" /></div>
        <p className="text-xs muted self-end">It&apos;s recorded as where the client already was, not as a step done today.</p>
        <h2 className="text-lg sm:col-span-2">Documents from before the platform</h2>
        <div><label className="label" htmlFor="c-ctr">Signed contract (scan)</label><input id="c-ctr" name="contractFile" type="file" accept="application/pdf,image/jpeg,image/png" className={fileCls} /></div>
        <div><label className="label" htmlFor="c-ctrd">Date the contract was signed</label><input id="c-ctrd" name="contractSignedOn" type="date" className="input" /></div>
        <div><label className="label" htmlFor="c-off">Offer letter</label><input id="c-off" name="offerFile" type="file" accept="application/pdf,image/jpeg,image/png" className={fileCls} /></div>
        <div><label className="label" htmlFor="c-offd">Date on the offer letter</label><input id="c-offd" name="offerDate" type="date" className="input" /></div>
        <div><label className="label" htmlFor="c-visa">Visa</label><input id="c-visa" name="visaFile" type="file" accept="application/pdf,image/jpeg,image/png" className={fileCls} /></div>
        <div><label className="label" htmlFor="c-visad">Date the visa was issued</label><input id="c-visad" name="visaDate" type="date" className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="c-docs">Other application documents (you can choose several)</label><input id="c-docs" name="otherDocs" type="file" multiple accept="application/pdf,image/jpeg,image/png" className={fileCls} /></div>
        <h2 className="text-lg sm:col-span-2">Previous payments</h2>
        <p className="text-sm muted sm:col-span-2">Only payments you can support with a record. Finance validates each one before it counts; nothing is invoiced twice.</p>
        <div><label className="label" htmlFor="c-cur">Currency</label><select id="c-cur" name="currency" className="input" defaultValue="USD">{["USD", "EUR", "RWF", "GBP", "CAD"].map((c) => <option key={c}>{c}</option>)}</select></div>
        <div />
        {Array.from({ length: pays }, (_, i) => (
          <fieldset key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-5" data-testid="previous-payment"><legend className="px-1 text-sm font-semibold">Payment {i + 1}</legend>
            <div><label className="label" htmlFor={`pa${i}`}>Amount</label><input id={`pa${i}`} name={`payAmount${i}`} inputMode="decimal" className="input" /></div>
            <div><label className="label" htmlFor={`pd${i}`}>Date paid</label><input id={`pd${i}`} name={`payDate${i}`} type="date" className="input" /></div>
            <div><label className="label" htmlFor={`pr${i}`}>Reference</label><input id={`pr${i}`} name={`payRef${i}`} className="input" maxLength={80} /></div>
            <div><label className="label" htmlFor={`pm${i}`}>Method</label><select id={`pm${i}`} name={`payMethod${i}`} className="input" defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option></select></div>
            <div><label className="label" htmlFor={`pp${i}`}>Evidence</label><input id={`pp${i}`} name={`payProof${i}`} type="file" accept="application/pdf,image/jpeg,image/png" className={fileCls} /></div>
          </fieldset>
        ))}
        {pays < 3 && <button type="button" className="btn-ghost btn-sm justify-self-start" onClick={() => setPays(pays + 1)}>Add another payment</button>}
      </>}
      <div className="sm:col-span-2"><label className="label" htmlFor="c-note">Notes for the application (optional)</label><textarea id="c-note" name="note" rows={3} className="input" maxLength={2000} /></div>
      {state?.error && <p role="alert" className="font-medium text-red-700 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{pending ? "Saving…" : existing ? "Register existing client" : "Create client account"}</button></div>
    </form>
  );
}
