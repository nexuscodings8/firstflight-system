import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/content/entities";
import { fieldOptions } from "@/lib/content/options";
import { EntityForm } from "@/components/content/entity-form";

export default async function NewEntity({ params }: { params: Promise<{ entity: string }> }) {
  const e = getEntity((await params).entity);
  if (!e) notFound();
  return (
    <div className="grid gap-4">
      <Link href={`/staff/content/${e.key}`} className="text-sm font-semibold text-brand">← {e.plural}</Link>
      <h1 className="text-[clamp(26px,3vw,36px)]">New {e.singular}</h1>
      {e.hasStatus && <p className="text-sm muted">It is saved as a draft. You can add {e.requirements ? "its document checklist, " : ""}preview it and publish it on the next screen.</p>}
      <section className="card p-6"><EntityForm entity={e} options={await fieldOptions(e)} /></section>
    </div>
  );
}
