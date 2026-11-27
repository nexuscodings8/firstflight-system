import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { visaCandidates, visaCategories } from "@/lib/queries";
import { countryName } from "@/lib/locations";
import { pickGuidance } from "@/lib/visa-match";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Checklist } from "@/components/checklist";
import { Icon } from "@/components/icons";
import { PublicFee } from "@/components/public-fee";
import { countryIdByIso, publicFee } from "@/lib/public-fee";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Your visa checklist" };
const ISO = /^[A-Z]{2}$/;

export default async function VisaResult({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const nat = q.nat?.toUpperCase() ?? "", res = q.res?.toUpperCase() ?? "", dest = q.dest?.toUpperCase() ?? "", purpose = q.purpose ?? "", city = (q.city ?? "").trim().slice(0, 80);
  if (![nat, res, dest].every((x) => ISO.test(x)) || !purpose) redirect("/visa");
  const cats = await visaCategories();
  const cat = cats.find((c) => c.slug === purpose);
  if (!cat) redirect("/visa");
  const m = pickGuidance(await visaCandidates(dest, purpose), { nationality: nat, residence: res, city });
  const inputs = { nat, res, dest, city, purpose };
  const qs = new URLSearchParams(Object.entries(inputs).filter(([, v]) => v)).toString();
  const summary = [["Passport", countryName(nat)], ["Residence", countryName(res)], ["Destination", `${city ? city + ", " : ""}${countryName(dest)}`], ["Purpose", cat.name]];
  const items = m.guidance ? [...m.guidance.requirements, ...(m.cityExtra?.requirements ?? [])] : [];
  const fee = m.guidance ? await publicFee({ service: "VISA", visaCategoryId: m.guidance.categoryId, countryId: await countryIdByIso(dest) }) : null;
  const local = [m.guidance?.localGuidance, m.cityExtra?.localGuidance].filter(Boolean) as string[];

  return (
    <div className="wrap max-w-5xl">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: `/visa?${qs}`, label: "Visa Processing" }, { label: "Your checklist" }]} />
      <div className="card grid gap-2 p-4 sm:grid-cols-4">{summary.map(([k, v]) => <div key={k}><p className="text-xs muted">{k}</p><p className="font-semibold">{v}</p></div>)}</div>

      {m.needsConsultation ? (
        <section className="mt-6 rounded-2xl border-2 border-gold bg-gold/10 p-6 sm:p-8">
          <div className="flex gap-3"><Icon name="alert" className="size-6 shrink-0 text-amber-700" />
            <div>
              <h1 className="text-2xl sm:text-3xl">{m.reason === "none" ? "We need to confirm these requirements for you" : "These requirements need a consultant's confirmation"}</h1>
              <p className="mt-2">{m.reason === "none" ? "We don't have checked guidance for this combination yet." : m.reason === "stale" ? "Our guidance for this trip has not been checked recently." : "Our team is reviewing the guidance for this trip."} A FIRST FLIGHT consultant will check the official requirements for your situation and send you a checklist.</p>
              <Link href={`/enquire?type=VISA_CONSULTATION&${qs}`} className="btn-primary mt-5">Request a visa consultation</Link>
            </div>
          </div>
          {m.guidance && <p className="mt-4 text-sm muted">Meanwhile you can read the official source: <a className="text-brand underline" href={m.guidance.sourceUrl} target="_blank" rel="noopener noreferrer">{m.guidance.sourceName}</a>.</p>}
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="card p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl">{m.guidance!.title}</h1>
            <p className="mt-2 muted">{m.guidance!.summary}</p>
            <h2 className="mt-6 text-xl">Your document checklist</h2>
            <Checklist items={items} />
            {local.length > 0 && <div className="mt-6 rounded-xl bg-mist p-4"><h2 className="text-lg">Local guidance{city ? ` for ${city}` : ""}</h2>{local.map((l) => <p key={l} className="mt-1">{l}</p>)}</div>}
          </section>
          <aside className="space-y-4">
            <div className="card p-6">
              <h2 className="text-lg">Official source</h2>
              <a href={m.guidance!.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand underline">{m.guidance!.sourceName} <Icon name="external" className="size-4" /></a>
              <p className="mt-3 text-sm"><span className="muted">Last checked:</span> <strong>{date(m.guidance!.lastCheckedAt)}</strong></p>
              {m.guidance!.processingTime && <p className="mt-1 text-sm"><span className="muted">Processing time:</span> {m.guidance!.processingTime}</p>}
              {m.guidance!.feeNote && <p className="mt-1 text-sm"><span className="muted">Fee:</span> {m.guidance!.feeNote}</p>}
              <p className="mt-3 text-xs muted">Requirements can change. Always confirm with the official source before you apply.</p>
            </div>
            <div className="card p-6">
              <h2 className="text-lg">Want us to handle it?</h2>
              <PublicFee fee={fee} />
              <Link href={`/apply?visa=${m.guidance!.id}&${qs}`} className="btn-gold mt-3 w-full">Apply for visa processing</Link>
              <Link href={`/enquire?type=VISA_CONSULTATION&${qs}`} className="btn-ghost mt-2 w-full">Request a visa consultation</Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
