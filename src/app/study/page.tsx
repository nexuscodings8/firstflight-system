import type { Metadata } from "next";
import Link from "next/link";
import { studyContinents } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PlaceCard } from "@/components/cards";

export const metadata: Metadata = { title: "Study Abroad" };

export default async function StudyPage() {
  const list = (await studyContinents()).filter((c) => c.countries > 0);
  return (
    <>
      <PageHero title="Explore study programs" intro="Choose a continent, then a country, university and program. Or search every program by level and intake.">
        <form action="/study/search" className="mt-6 flex max-w-xl gap-2" role="search">
          <label htmlFor="hero-q" className="sr-only">Search programs or universities</label>
          <input id="hero-q" name="q" className="input" placeholder="Program or university, e.g. Data Science" />
          <button className="btn-gold shrink-0">Search</button>
        </form>
      </PageHero>
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Study Abroad" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl">Choose a continent</h2><Link href="/study/search" className="btn-ghost btn-sm">Search and filter all programs</Link></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => <PlaceCard key={c.id} href={`/study/${c.slug}`} title={c.name} meta={`${c.countries} countr${c.countries === 1 ? "y" : "ies"}`} />)}
        </div>
      </div>
    </>
  );
}
