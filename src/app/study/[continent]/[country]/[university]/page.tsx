import { notFound } from "next/navigation";
import { getUniversity } from "@/lib/queries";
import { previewMode } from "@/lib/preview";
import { PreviewBanner } from "@/components/preview-banner";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Empty, ProgramCard } from "@/components/cards";
import { Icon } from "@/components/icons";

type P = { params: Promise<{ continent: string; country: string; university: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function UniPage({ params, searchParams }: P) {
  const { continent, country, university } = await params;
  const preview = await previewMode(await searchParams);
  const u = await getUniversity(university, preview);
  if (!u || u.country.slug !== country || u.country.continent?.slug !== continent) notFound();
  const ctx = { uni: { name: u.name, slug: u.slug }, country: { name: u.country.name, slug: u.country.slug }, continent: { slug: continent } };
  return (
    <>
      {preview && <PreviewBanner status={u.status} editHref={`/staff/content/universities/${u.id}`} />}
      <PageHero title={u.name} intro={`${u.city}, ${u.country.name}. ${u.description}`}>
        {u.website && <a href={u.website} target="_blank" rel="noopener noreferrer" className="btn-gold mt-6">University website <Icon name="external" className="size-4" /></a>}
      </PageHero>
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/study", label: "Study Abroad" }, { href: `/study/${continent}`, label: u.country.continent!.name }, { href: `/study/${continent}/${country}`, label: u.country.name }, { label: u.name }]} />
        <h2 className="text-2xl">Programs</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{u.programs.map((p) => <ProgramCard key={p.id} r={{ program: p, ...ctx }} />)}</div>
        {!u.programs.length && <Empty title="No programs listed yet" />}
      </div>
    </>
  );
}
