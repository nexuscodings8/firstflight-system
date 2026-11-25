import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AvailabilityBadge, canApply } from "@/components/badges";
import { Checklist } from "@/components/checklist";
import { Icon } from "@/components/icons";
import { date, label, tuitionText } from "@/lib/format";

type P = { params: Promise<{ continent: string; country: string; university: string; program: string }> };

export async function generateMetadata({ params }: P) {
  const p = await getProgram((await params).program);
  return { title: p ? `${p.name}, ${p.university.name}` : "Program" };
}

export default async function ProgramPage({ params }: P) {
  const { continent, country, university, program } = await params;
  const p = await getProgram(program);
  if (!p || p.university.slug !== university || p.university.country.slug !== country || p.university.country.continent?.slug !== continent) notFound();
  const facts: [string, string, string][] = [
    ["cap", "Study level", label(p.level)],
    ["calendar", "Intake", p.intakes.join(", ")],
    ["clock", "Duration", p.duration],
    ["money", "Tuition", tuitionText(p.tuitionAmount, p.tuitionCurrency, p.billingPeriod)],
    ["calendar", "Application deadline", date(p.deadline)],
    ["globe", "Language requirements", p.language],
  ];
  return (
    <div className="wrap">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/study", label: "Study Abroad" }, { href: `/study/${continent}`, label: p.university.country.continent!.name }, { href: `/study/${continent}/${country}`, label: p.university.country.name }, { href: `/study/${continent}/${country}/${university}`, label: p.university.name }, { label: p.name }]} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="card p-6 sm:p-8">
          <div className="flex flex-wrap gap-2"><span className="badge bg-mist text-brand">{label(p.level)}</span><AvailabilityBadge value={p.availability} /></div>
          <h1 className="mt-3 text-3xl sm:text-4xl">{p.name}</h1>
          <p className="mt-2 text-lg muted">{p.university.name} · {p.university.city}, {p.university.country.name}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {facts.map(([ic, k, v]) => <div key={k} className="flex gap-3 rounded-xl bg-mist p-4"><Icon name={ic} className="size-5 shrink-0 text-brand" /><div><dt className="text-sm muted">{k}</dt><dd className="font-semibold">{v}</dd></div></div>)}
          </dl>
          <h2 className="mt-8 text-xl">Admission criteria</h2><p className="mt-2 whitespace-pre-line">{p.admission}</p>
        </article>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="card p-6">
            <h2 className="text-xl">Document checklist</h2>
            <Checklist items={p.requirements} />
            {canApply(p.availability) && <Link href={`/apply?program=${p.id}`} className="btn-gold mt-5 w-full">Apply for this program</Link>}
            <Link href={`/enquire?type=PROGRAM_GUIDANCE&program=${p.id}`} className="btn-ghost mt-2 w-full">Request guidance</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
