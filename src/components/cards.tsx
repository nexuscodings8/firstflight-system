import Link from "next/link";
import { Icon } from "./icons";
import { AvailabilityBadge } from "./badges";
import { date, salaryText, tuitionText, label } from "@/lib/format";

type JobRow = { job: { slug: string; title: string; location: string; employmentType: string; salaryMin: string | null; salaryMax: string | null; salaryCurrency: string; salaryPeriod: string; deadline: Date | null; availability: string; summary: string }; country: { name: string; slug: string }; category?: { name: string } };

export function JobCard({ r }: { r: JobRow }) {
  const href = `/work/${r.country.slug}/${r.job.slug}`;
  return (
    <Link href={href} className="card-link flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg leading-snug">{r.job.title}</h3>
        <AvailabilityBadge value={r.job.availability} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm muted"><Icon name="pin" className="size-4" />{r.job.location}, {r.country.name}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center gap-2"><Icon name="money" className="size-4 text-brand" /><dt className="sr-only">Salary</dt><dd className="font-semibold">{salaryText(r.job.salaryMin, r.job.salaryMax, r.job.salaryCurrency, r.job.salaryPeriod)}</dd></div>
        <div className="flex items-center gap-2"><Icon name="briefcase" className="size-4 text-brand" /><dt className="sr-only">Type</dt><dd>{label(r.job.employmentType)}{r.category ? ` · ${r.category.name}` : ""}</dd></div>
        <div className="flex items-center gap-2"><Icon name="calendar" className="size-4 text-brand" /><dt className="sr-only">Deadline</dt><dd>Apply by {date(r.job.deadline)}</dd></div>
      </dl>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">View job <Icon name="arrow" className="size-4" /></span>
    </Link>
  );
}

type ProgramRow = { program: { slug: string; name: string; level: string; intakes: string[]; duration: string; tuitionAmount: string | null; tuitionCurrency: string; billingPeriod: string; availability: string }; uni: { name: string; slug: string }; country: { name: string; slug: string }; continent: { slug: string } };

export const programHref = (r: ProgramRow) => `/study/${r.continent.slug}/${r.country.slug}/${r.uni.slug}/${r.program.slug}`;

export function ProgramCard({ r }: { r: ProgramRow }) {
  return (
    <Link href={programHref(r)} className="card-link flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg leading-snug">{r.program.name}</h3>
        <span className="badge bg-mist text-brand">{label(r.program.level)}</span>
      </div>
      <p className="mt-1 text-sm muted">{r.uni.name} · {r.country.name}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex items-center gap-2"><Icon name="calendar" className="size-4 text-brand" /><dt className="sr-only">Intake</dt><dd>{r.program.intakes.join(", ")}</dd></div>
        <div className="flex items-center gap-2"><Icon name="clock" className="size-4 text-brand" /><dt className="sr-only">Duration</dt><dd>{r.program.duration}</dd></div>
        <div className="flex items-center gap-2"><Icon name="money" className="size-4 text-brand" /><dt className="sr-only">Tuition</dt><dd className="font-semibold">{tuitionText(r.program.tuitionAmount, r.program.tuitionCurrency, r.program.billingPeriod)}</dd></div>
      </dl>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">Explore program <Icon name="arrow" className="size-4" /></span>
    </Link>
  );
}

export function PlaceCard({ href, title, meta, text }: { href: string; title: string; meta: string; text?: string | null }) {
  return (
    <Link href={href} className="card-link group p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl">{title}</h3>
        <span className="grid size-9 place-items-center rounded-full bg-mist text-brand transition group-hover:bg-brand group-hover:text-white"><Icon name="arrow" className="size-4" /></span>
      </div>
      <p className="mt-1 text-sm font-semibold text-brand">{meta}</p>
      {text && <p className="mt-2 text-sm muted">{text}</p>}
    </Link>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-mist/50 p-8 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-2 text-sm muted">{children}</div>}
    </div>
  );
}
