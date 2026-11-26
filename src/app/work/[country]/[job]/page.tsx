import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/queries";
import { previewMode } from "@/lib/preview";
import { PreviewBanner } from "@/components/preview-banner";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AvailabilityBadge, canApply } from "@/components/badges";
import { Checklist } from "@/components/checklist";
import { Icon } from "@/components/icons";
import { date, label, salaryText } from "@/lib/format";

type P = { params: Promise<{ country: string; job: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: P) {
  const { country, job } = await params;
  const j = await getJob(country, job);
  return { title: j ? `${j.title}, ${j.country.name}` : "Job" };
}

export default async function JobDetail({ params, searchParams }: P) {
  const { country, job } = await params;
  const preview = await previewMode(await searchParams);
  const j = await getJob(country, job, preview);
  if (!j) notFound();
  const open = canApply(j.availability);
  const facts: [string, string, string][] = [
    ["pin", "Location", `${j.location}, ${j.country.name}`],
    ["money", "Salary", salaryText(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod)],
    ["briefcase", "Employment type", label(j.employmentType)],
    ["calendar", "Application deadline", date(j.deadline)],
  ];
  return (
    <>
    {preview && <PreviewBanner status={j.status} editHref={`/staff/content/jobs/${j.id}`} />}
    <div className="wrap">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/work", label: "Work Abroad" }, { href: `/work/${j.country.slug}`, label: j.country.name }, { label: j.title }]} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2"><span className="badge bg-mist text-brand">{j.category.name}</span><AvailabilityBadge value={j.availability} /></div>
          <h1 className="mt-3 text-3xl sm:text-4xl">{j.title}</h1>
          <p className="mt-3 text-lg muted">{j.summary}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {facts.map(([ic, k, v]) => (
              <div key={k} className="flex gap-3 rounded-xl bg-mist p-4"><Icon name={ic} className="size-5 shrink-0 text-brand" /><div><dt className="text-sm muted">{k}</dt><dd className="font-semibold">{v}</dd></div></div>
            ))}
          </dl>
          <h2 className="mt-8 text-xl">About the job</h2><p className="mt-2 whitespace-pre-line">{j.description}</p>
          <h2 className="mt-6 text-xl">Eligibility criteria</h2><p className="mt-2 whitespace-pre-line">{j.eligibility}</p>
          <h2 className="mt-6 text-xl">Benefits</h2><p className="mt-2 whitespace-pre-line">{j.benefits}</p>
        </article>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6">
            <h2 className="text-xl">Required documents</h2>
            <Checklist items={j.requirements} />
            {open ? (
              <Link href={`/apply?job=${j.id}`} className="btn-gold mt-5 w-full">Apply for this job</Link>
            ) : (
              <p className="mt-5 rounded-xl bg-mist p-3 text-sm">This job is not accepting applications.</p>
            )}
            <Link href={`/enquire?type=JOB_QUESTION&job=${j.id}`} className="btn-ghost mt-2 w-full">Ask a consultant about this job</Link>
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
