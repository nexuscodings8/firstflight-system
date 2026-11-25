import type { Metadata } from "next";
import Link from "next/link";
import { searchPrograms, studyFilterOptions } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Empty, ProgramCard } from "@/components/cards";
import { label } from "@/lib/format";

export const metadata: Metadata = { title: "Search study programs" };
const LEVELS = ["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "LANGUAGE"];

export default async function StudySearch({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const [rows, opt] = await Promise.all([searchPrograms(f), studyFilterOptions()]);
  return (
    <>
      <PageHero title="Search study programs" intro="Filter by country, university, program, study level or intake." />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/study", label: "Study Abroad" }, { label: "Search" }]} />
        <form action="/study/search" className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.3fr_1fr_1.2fr_1fr_1fr_auto] xl:items-end">
          <div><label className="label" htmlFor="q">Program or university</label><input className="input" id="q" name="q" defaultValue={f.q} /></div>
          <div><label className="label" htmlFor="country">Country</label><select className="input" id="country" name="country" defaultValue={f.country ?? ""}><option value="">All countries</option>{opt.countries.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="university">University</label><select className="input" id="university" name="university" defaultValue={f.university ?? ""}><option value="">All universities</option>{opt.unis.map((u) => <option key={u.slug} value={u.slug}>{u.name}</option>)}</select></div>
          <div><label className="label" htmlFor="level">Study level</label><select className="input" id="level" name="level" defaultValue={f.level ?? ""}><option value="">All levels</option>{LEVELS.map((l) => <option key={l} value={l}>{label(l)}</option>)}</select></div>
          <div><label className="label" htmlFor="intake">Intake</label><select className="input" id="intake" name="intake" defaultValue={f.intake ?? ""}><option value="">Any intake</option>{opt.intakes.map((i) => <option key={i}>{i}</option>)}</select></div>
          <div className="flex gap-2"><button className="btn-primary">Search</button><Link href="/study/search" className="btn-ghost">Reset</Link></div>
        </form>
        <p className="mt-6 text-sm muted" aria-live="polite">{rows.length} program{rows.length === 1 ? "" : "s"} found</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((r) => <ProgramCard key={r.program.id} r={r} />)}</div>
        {!rows.length && <Empty title="No programs match">Try a different level or intake, or <Link className="text-brand underline" href="/enquire?type=PROGRAM_GUIDANCE">ask a consultant</Link>.</Empty>}
      </div>
    </>
  );
}
