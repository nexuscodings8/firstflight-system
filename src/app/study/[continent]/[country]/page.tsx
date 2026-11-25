import { notFound } from "next/navigation";
import { getCountryBySlug, universitiesIn } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Empty, PlaceCard } from "@/components/cards";

type P = { params: Promise<{ continent: string; country: string }> };

export default async function CountryUnis({ params }: P) {
  const { continent, country } = await params;
  const c = await getCountryBySlug(country);
  if (!c || !c.studyDestination || c.continent?.slug !== continent) notFound();
  const list = await universitiesIn(c.id);
  return (
    <>
      <PageHero title={`Universities in ${c.name}`} intro="Choose a university to see its programs." />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/study", label: "Study Abroad" }, { href: `/study/${continent}`, label: c.continent!.name }, { label: c.name }]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ uni, programs }) => <PlaceCard key={uni.id} href={`/study/${continent}/${country}/${uni.slug}`} title={uni.name} meta={`${uni.city} · ${programs} program${programs === 1 ? "" : "s"}`} text={uni.description} />)}
        </div>
        {!list.length && <Empty title={`No universities listed in ${c.name} yet`} />}
      </div>
    </>
  );
}
