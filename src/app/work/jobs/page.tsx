import type { Metadata } from "next";
import { jobCategories, listJobs, workCountries } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JobFilters } from "@/components/job-filters";
import { Empty, JobCard } from "@/components/cards";

export const metadata: Metadata = { title: "All jobs abroad" };
type SP = Promise<Record<string, string | undefined>>;

export default async function JobsPage({ searchParams }: { searchParams: SP }) {
  const f = await searchParams;
  const [rows, countries, cats] = await Promise.all([listJobs(f), workCountries(), jobCategories()]);
  return (
    <>
      <PageHero title="All jobs abroad" intro="Filter by country, job category and availability." />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/work", label: "Work Abroad" }, { label: "All jobs" }]} />
        <JobFilters action="/work/jobs" countries={countries} categories={cats} value={f} />
        <p className="mt-6 text-sm muted" aria-live="polite">{rows.length} job{rows.length === 1 ? "" : "s"} found</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((r) => <JobCard key={r.job.id} r={r} />)}</div>
        {!rows.length && <Empty title="No jobs match these filters">Try another category, or reset the filters.</Empty>}
      </div>
    </>
  );
}
