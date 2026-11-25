"use client";
import { useEffect, useState } from "react";

type Country = { iso: string; name: string };
type Cat = { slug: string; name: string };

/** Guided visa checker. Countries and cities come from our /api/locations endpoints. Submits a GET to /visa/result. */
export function VisaChecker({ categories, initial }: { categories: Cat[]; initial: Record<string, string | undefined> }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [dest, setDest] = useState(initial.dest ?? "");
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/locations/countries").then((r) => r.json()).then(setCountries).catch(() => setError("Could not load countries. Refresh the page to try again."));
  }, []);
  useEffect(() => {
    if (!dest) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`/api/locations/cities?country=${dest}`).then((r) => r.json()).then((c) => setCities(Array.isArray(c) ? c : [])).catch(() => setCities([])).finally(() => setLoadingCities(false));
  }, [dest]);

  const sel = (id: string, name: string, text: string, def?: string, onChange?: (v: string) => void) => (
    <div>
      <label className="label" htmlFor={id}>{text}</label>
      <select className="input" id={id} name={name} required defaultValue={def ?? ""} onChange={(e) => onChange?.(e.target.value)} disabled={!countries.length}>
        <option value="">{countries.length ? "Choose a country" : "Loading countries…"}</option>
        {countries.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
      </select>
    </div>
  );

  return (
    <form action="/visa/result" className="card grid gap-5 p-6 sm:grid-cols-2">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
      {sel("nat", "nat", "1. Passport nationality", initial.nat)}
      {sel("res", "res", "2. Country of residence", initial.res)}
      {sel("dest", "dest", "3. Destination country", initial.dest, setDest)}
      <div>
        <label className="label" htmlFor="city">4. Destination city</label>
        <input className="input" id="city" name="city" list="city-list" defaultValue={initial.city} placeholder={dest ? (loadingCities ? "Loading cities…" : "Start typing a city") : "Choose a destination first"} disabled={!dest} autoComplete="off" />
        <datalist id="city-list">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        <p className="mt-1 text-xs muted">Optional. Some cities have extra local guidance.</p>
      </div>
      <div className="sm:col-span-2">
        <span className="label" id="purpose-label">5. Purpose of the visit</span>
        <div role="radiogroup" aria-labelledby="purpose-label" className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.slug} className="cursor-pointer">
              <input type="radio" name="purpose" value={c.slug} required defaultChecked={initial.purpose === c.slug} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-medium peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/30">{c.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2"><button className="btn-gold w-full sm:w-auto">Show my checklist</button></div>
    </form>
  );
}
