import Link from "next/link";

type Opt = { slug: string; name: string };
/** Plain GET form: works without JavaScript and keeps filters in the URL. */
export function JobFilters({ action, countries, categories, value, showCountry = true }: { action: string; countries: Opt[]; categories: Opt[]; value: { country?: string; category?: string; availability?: string; q?: string }; showCountry?: boolean }) {
  return (
    <form action={action} className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
      <div><label className="label" htmlFor="q">Search</label><input className="input" id="q" name="q" defaultValue={value.q} placeholder="Job title or city" /></div>
      {showCountry && (
        <div><label className="label" htmlFor="country">Country</label>
          <select className="input" id="country" name="country" defaultValue={value.country ?? ""}><option value="">All countries</option>{countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
      )}
      <div><label className="label" htmlFor="category">Job category</label>
        <select className="input" id="category" name="category" defaultValue={value.category ?? ""}><option value="">All categories</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
      <div><label className="label" htmlFor="availability">Availability</label>
        <select className="input" id="availability" name="availability" defaultValue={value.availability ?? ""}><option value="">Any</option><option value="open">Open for applications</option><option value="closed">Closed</option><option value="filled">Filled</option></select></div>
      <div className="flex gap-2"><button className="btn-primary">Apply filters</button><Link href={action} className="btn-ghost">Reset</Link></div>
    </form>
  );
}
