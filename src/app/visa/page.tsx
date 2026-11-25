import type { Metadata } from "next";
import { visaCategories } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VisaChecker } from "@/components/visa-checker";

export const metadata: Metadata = { title: "Check visa requirements" };

export default async function VisaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [cats, initial] = await Promise.all([visaCategories(), searchParams]);
  return (
    <>
      <PageHero title="Check visa requirements" intro="Answer five questions to get a personalised document checklist, with the official source and the date we last checked it." />
      <div className="wrap max-w-4xl">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Visa Processing" }]} />
        <VisaChecker categories={cats.map((c) => ({ slug: c.slug, name: c.name }))} initial={initial} />
      </div>
    </>
  );
}
