"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { submitFlight } from "@/app/flights/actions";

type Country = { iso: string; name: string };

function Place({ prefix, label, countries, defaultIso }: { prefix: "from" | "to"; label: string; countries: Country[]; defaultIso?: string }) {
  const [iso, setIso] = useState(defaultIso ?? "");
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => {
    if (!iso) return;
    let live = true;
    fetch(`/api/locations/cities?country=${iso}`).then((r) => r.json()).then((c) => { if (live) setCities(Array.isArray(c) ? c : []); }).catch(() => {});
    return () => { live = false; };
  }, [iso]);
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-1 font-semibold">{label}</legend>
      <div><label className="label" htmlFor={`${prefix}Country`}>Country</label>
        <select className="input" id={`${prefix}Country`} name={`${prefix}Country`} required value={iso} onChange={(e) => setIso(e.target.value)}><option value="" disabled>Choose…</option>{countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
      <div><label className="label" htmlFor={`${prefix}City`}>City or airport</label>
        <input className="input" id={`${prefix}City`} name={`${prefix}City`} list={`${prefix}-cities`} required autoComplete="off" disabled={!iso} placeholder={iso ? "Start typing" : "Choose a country first"} />
        <datalist id={`${prefix}-cities`}>{iso && cities.map((c) => <option key={c} value={c} />)}</datalist></div>
    </fieldset>
  );
}

export function FlightForm({ countries, user }: { countries: Country[]; user?: { name: string; email: string } | null }) {
  const [state, run, pending] = useActionState(submitFlight, undefined);
  const [trip, setTrip] = useState("RETURN");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form className="grid gap-6" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <Place prefix="from" label="Flying from" countries={countries} defaultIso="RW" />
      <Place prefix="to" label="Flying to" countries={countries} />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 font-semibold">When</legend>
        <div><span className="label" id="trip-l">Trip</span>
          <div role="radiogroup" aria-labelledby="trip-l" className="flex gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="trip" value="RETURN" checked={trip === "RETURN"} onChange={() => setTrip("RETURN")} className="accent-brand" /> Return</label>
            <label className="flex items-center gap-2"><input type="radio" name="trip" value="ONE_WAY" checked={trip === "ONE_WAY"} onChange={() => setTrip("ONE_WAY")} className="accent-brand" /> One way</label>
          </div></div>
        <div><label className="label" htmlFor="departDate">Travel date</label><input className="input" id="departDate" name="departDate" type="date" min={today} required /></div>
        {trip === "RETURN" && <div><label className="label" htmlFor="returnDate">Return date</label><input className="input" id="returnDate" name="returnDate" type="date" min={today} required /></div>}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-1 font-semibold">Who is travelling</legend>
        <div><label className="label" htmlFor="adults">Adults (12+)</label><input className="input" id="adults" name="adults" type="number" min={1} max={9} defaultValue={1} required /></div>
        <div><label className="label" htmlFor="children">Children (2–11)</label><input className="input" id="children" name="children" type="number" min={0} max={8} defaultValue={0} /></div>
        <div><label className="label" htmlFor="infants">Infants (under 2)</label><input className="input" id="infants" name="infants" type="number" min={0} max={4} defaultValue={0} /></div>
        <div><label className="label" htmlFor="travelClass">Class</label><select className="input" id="travelClass" name="travelClass" defaultValue="ECONOMY"><option value="ECONOMY">Economy</option><option value="PREMIUM_ECONOMY">Premium economy</option><option value="BUSINESS">Business</option><option value="FIRST">First</option></select></div>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 font-semibold">Your details</legend>
        <div><label className="label" htmlFor="name">Full name</label><input className="input" id="name" name="name" required autoComplete="name" defaultValue={user?.name} /></div>
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" defaultValue={user?.email} /></div>
        <div><label className="label" htmlFor="phone">Phone or WhatsApp</label><input className="input" id="phone" name="phone" type="tel" required autoComplete="tel" /></div>
        <div className="sm:col-span-3"><label className="label" htmlFor="notes">Anything else (optional)</label><textarea className="input" id="notes" name="notes" rows={3} maxLength={1000} placeholder="Preferred airline, flexible dates, extra baggage…" /></div>
      </fieldset>
      {state?.error && <p role="alert" className="font-medium text-red-700">{state.error}</p>}
      <div><button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Request flight options"}</button></div>
    </form>
  );
}
