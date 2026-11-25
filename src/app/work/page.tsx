import type { Metadata } from "next";
import Link from "next/link";
import { workCountries } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PlaceCard } from "@/components/cards";

export const metadata: Metadata = { title: "Work Abroad" };

export default async function WorkPage() {
  const countries = await workCountries();
  return (
    <>
      <PageHero title="Find jobs abroad" intro="Choose a destination to see its job offers, or search every job at once.">
        <Link href="/work/jobs" className="btn-gold mt-6">Search all jobs</Link>
      </PageHero>
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Work Abroad" }]} />
        <h2 className="text-2xl">Destination countries</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((c) => <PlaceCard key={c.id} href={`/work/${c.slug}`} title={c.name} meta={`${c.openJobs} open job offer${c.openJobs === 1 ? "" : "s"}`} text={c.blurb} />)}
        </div>
      </div>
    </>
  );
}
