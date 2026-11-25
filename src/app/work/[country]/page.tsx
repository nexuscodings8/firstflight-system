import { notFound } from "next/navigation";
import { getCountryBySlug, jobCategories, listJobs } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JobFilters } from "@/components/job-filters";
import { Empty, JobCard } from "@/components/cards";

type P = { params: Promise<{ country: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P) {
  const c = await getCountryBySlug((await params).country);
  return { title: c ? `Jobs in ${c.name}` : "Jobs" };
}

export default async function CountryJobs({ params, searchParams }: P) {
  const { country } = await params;
  const f = await searchParams;
  const c = await getCountryBySlug(country);
  if (!c || !c.workDestination) notFound();
  const [rows, cats] = await Promise.all([listJobs({ ...f, country }), jobCategories()]);
  return (
    <>
      <PageHero title={`Jobs in ${c.name}`} intro={c.blurb ?? undefined} />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/work", label: "Work Abroad" }, { label: c.name }]} />
        <JobFilters action={`/work/${country}`} countries={[]} categories={cats} value={f} showCountry={false} />
        <p className="mt-6 text-sm muted" aria-live="polite">{rows.length} job offer{rows.length === 1 ? "" : "s"}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((r) => <JobCard key={r.job.id} r={r} />)}</div>
        {!rows.length && <Empty title={`No job offers in ${c.name} match`}>Reset the filters, or speak to a consultant about upcoming roles.</Empty>}
      </div>
    </>
  );
}
