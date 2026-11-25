import { notFound } from "next/navigation";
import { studyContinents, studyCountries } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Empty, PlaceCard } from "@/components/cards";

type P = { params: Promise<{ continent: string }> };

export default async function ContinentPage({ params }: P) {
  const { continent } = await params;
  const cont = (await studyContinents()).find((c) => c.slug === continent);
  if (!cont) notFound();
  const list = await studyCountries(continent);
  return (
    <>
      <PageHero title={`Study in ${cont.name}`} intro="Choose a country to see its universities." />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/study", label: "Study Abroad" }, { label: cont.name }]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => <PlaceCard key={c.id} href={`/study/${continent}/${c.slug}`} title={c.name} meta={`${c.universities} universit${c.universities === 1 ? "y" : "ies"}`} text={c.blurb} />)}
        </div>
        {!list.length && <Empty title="No study destinations here yet" />}
      </div>
    </>
  );
}
