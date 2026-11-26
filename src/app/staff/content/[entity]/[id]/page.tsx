import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getEntity, type Entity } from "@/lib/content/entities";
import { getRow, type Row } from "@/lib/content/store";
import { fieldOptions } from "@/lib/content/options";
import { SERVICE_LABEL, date, dateTime } from "@/lib/format";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";
import { nowMs } from "@/lib/finance";
import { ActionForm } from "@/components/action-form";
import { EntityForm } from "@/components/content/entity-form";
import { StatusBadge } from "@/components/content/status-badge";
import { addRequirement, changeRequirement, deleteEntity, reviewGuidance, setStatus } from "../../actions";

export const metadata = { title: "Edit content" };

/** Where a published record appears on the website, for the preview link. */
async function publicUrl(e: Entity, r: Row) {
  if (e.key === "news") return `/news/${r.slug}`;
  if (e.key === "jobs") {
    const c = await db.query.countries.findFirst({ where: eq(s.countries.id, String(r.countryId)), columns: { slug: true } });
    return c ? `/work/${c.slug}/${r.slug}` : null;
  }
  if (e.key === "universities" || e.key === "programs") {
    const uniId = e.key === "programs" ? String(r.universityId) : r.id;
    const u = await db.query.universities.findFirst({ where: eq(s.universities.id, uniId), columns: { slug: true }, with: { country: { columns: { slug: true }, with: { continent: { columns: { slug: true } } } } } });
    if (!u?.country.continent) return null;
    const base = `/study/${u.country.continent.slug}/${u.country.slug}/${u.slug}`;
    return e.key === "programs" ? `${base}/${r.slug}` : base;
  }
  return null;
}

function StatusButton({ e, id, status, text, style = "btn-ghost btn-sm" }: { e: Entity; id: string; status: string; text: string; style?: string }) {
  return (
    <ActionForm action={setStatus} submit={text} resetOnSuccess={false} className="grid gap-1" buttonClass={style}>
      <input type="hidden" name="entity" value={e.key} /><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} />
    </ActionForm>
  );
}

export default async function EditEntity({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { entity, id } = await params;
  const e = getEntity(entity);
  if (!e) notFound();
  const row = await getRow(e, id);
  if (!row) notFound();
  const sp = await searchParams;
  const [options, url, reqs, history] = await Promise.all([
    fieldOptions(e),
    publicUrl(e, row),
    e.requirements ? db.select().from(s.requirementItems).where(eq(s.requirementItems[e.requirements], row.id)).orderBy(asc(s.requirementItems.sortOrder)) : [],
    db.query.activities.findMany({ where: and(eq(s.activities.entityType, e.key), eq(s.activities.entityId, row.id)), orderBy: [desc(s.activities.createdAt)], limit: 15 }),
  ]);
  const title = String(row[e.titleField]);
  const status = String(row.status ?? "");
  const stale = e.key === "visa-guidance" && (row.reviewState === "NEEDS_REVIEW" || +(row.lastCheckedAt as Date) < nowMs() - STALE_AFTER_DAYS * 86_400_000);
  const hidden = <><input type="hidden" name="entity" value={e.key} /><input type="hidden" name="id" value={row.id} /></>;
  return (
    <div className="grid gap-5">
      <Link href={`/staff/content/${e.key}`} className="text-sm font-semibold text-brand">← {e.plural}</Link>
      {sp.created && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Created as a draft. {e.requirements ? "Add its document checklist, then " : ""}{url ? "preview and " : ""}publish it when it&apos;s ready.</p>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="eyebrow capitalize">{e.singular}</p><h1 className="text-[clamp(26px,3vw,36px)]">{title}</h1>{"slug" in row && <p className="text-xs muted">Web address name: {String(row.slug)}</p>}</div>
        {e.hasStatus && <StatusBadge status={status} />}
      </div>

      {e.hasStatus && (
        <section className="card flex flex-wrap items-start gap-3 p-4" aria-label="Publishing">
          {status !== "PUBLISHED" && <StatusButton e={e} id={row.id} status="PUBLISHED" text="Publish" style="btn-primary btn-sm" />}
          {status === "PUBLISHED" && <StatusButton e={e} id={row.id} status="DRAFT" text="Unpublish (back to draft)" />}
          {status !== "ARCHIVED" && <StatusButton e={e} id={row.id} status="ARCHIVED" text="Archive" />}
          {status === "ARCHIVED" && <StatusButton e={e} id={row.id} status="DRAFT" text="Restore as draft" />}
          {url && <a href={`${url}?preview=1`} target="_blank" rel="noopener" className="btn-ghost btn-sm">Preview on the website ↗</a>}
          {status === "DRAFT" && (
            <details className="ml-auto">
              <summary className="cursor-pointer py-2 text-sm text-red-700">Delete draft</summary>
              <ActionForm action={deleteEntity} submit={`Delete "${title}" permanently`} className="mt-2 grid gap-1" buttonClass="btn-sm btn border border-red-300 bg-white text-red-700 hover:bg-red-50">{hidden}</ActionForm>
            </details>
          )}
        </section>
      )}
      {!e.hasStatus && (
        <details className="text-sm"><summary className="cursor-pointer text-red-700">Delete this {e.singular}</summary>
          <ActionForm action={deleteEntity} submit={`Delete "${title}"`} className="mt-2 grid gap-1" buttonClass="btn-sm btn border border-red-300 bg-white text-red-700 hover:bg-red-50">{hidden}</ActionForm>
        </details>
      )}

      {e.key === "visa-guidance" && (
        <section className={`card p-5 ${stale ? "border-amber-300 bg-amber-50" : ""}`} aria-labelledby="rv">
          <h2 id="rv" className="text-lg">Source check</h2>
          <p className="mt-1 text-sm">Last checked {date(row.lastCheckedAt as Date)} against <a className="text-brand underline" href={String(row.sourceUrl)} target="_blank" rel="noopener noreferrer">{String(row.sourceName)} ↗</a>. {stale ? "Visitors are currently offered a consultation instead of this checklist." : "Visitors see this checklist."}</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <ActionForm action={reviewGuidance} submit="Mark as checked today" resetOnSuccess className="flex flex-wrap items-center gap-2" buttonClass="btn-primary btn-sm">
              <input type="hidden" name="id" value={row.id} /><input type="hidden" name="op" value="checked" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="size-4 accent-brand" /> I compared it with the official source today</label>
            </ActionForm>
            {row.reviewState !== "NEEDS_REVIEW" && <ActionForm action={reviewGuidance} submit="Flag for review" className="grid" buttonClass="btn-ghost btn-sm"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="op" value="flag" /></ActionForm>}
          </div>
        </section>
      )}

      {e.key === "promotions" && (
        <section aria-label="Preview" className="flex flex-col justify-between gap-4 rounded-2xl bg-gold p-6 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase">Preview</p><h3 className="text-xl">{title}</h3><p className="mt-1 text-ink/85">{String(row.body)}</p><p className="mt-2 text-sm font-semibold">Shown {date(row.startsAt as Date)} – {date(row.expiresAt as Date)}</p></div>
          <span className="btn-primary shrink-0">{String(row.ctaLabel)}</span>
        </section>
      )}
      {e.key === "testimonials" && (
        <figure className="card max-w-md p-5"><p className="text-xs font-bold uppercase muted">Preview</p><blockquote className="mt-1">“{String(row.quote)}”</blockquote><figcaption className="mt-3 text-sm font-semibold">{title} <span className="font-normal muted">· {SERVICE_LABEL[row.service as "WORK"]}</span></figcaption>{!row.consentGiven && <p className="mt-2 text-sm font-semibold text-red-700">No consent recorded: this can&apos;t be published.</p>}</figure>
      )}

      <section className="card p-6" aria-labelledby="det"><h2 id="det" className="mb-4 text-xl">Details</h2><EntityForm entity={e} row={row} options={options} /></section>

      {e.requirements && (
        <section className="card p-6" aria-labelledby="req">
          <h2 id="req" className="text-xl">Document checklist</h2>
          <p className="mt-1 text-sm muted">Applicants see this list and upload each document. Changes apply to new applications; submitted ones keep the checklist they were given.</p>
          <ol className="mt-3 divide-y divide-line">
            {reqs.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="w-6 text-sm muted">{i + 1}.</span>
                <span className="flex-1"><span className="font-semibold">{r.label}</span>{r.note && <span className="block text-xs muted">{r.note}</span>}</span>
                {(["toggle", "up", "down", "remove"] as const).map((op) => (
                  (op === "up" && i === 0) || (op === "down" && i === reqs.length - 1) ? null :
                    <ActionForm key={op} action={changeRequirement} submit={op === "toggle" ? (r.mandatory ? "Required" : "Optional") : op === "up" ? "↑" : op === "down" ? "↓" : "Remove"} className="grid" resetOnSuccess={false}
                      buttonClass={op === "remove" ? "btn-sm btn border border-red-200 bg-white px-2 text-red-700" : op === "toggle" ? `badge cursor-pointer ${r.mandatory ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}` : "btn-ghost btn-sm px-2"}>
                      {hidden}<input type="hidden" name="itemId" value={r.id} /><input type="hidden" name="op" value={op} />
                    </ActionForm>
                ))}
              </li>
            ))}
          </ol>
          {!reqs.length && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No documents yet.{e.key !== "visa-guidance" ? " Add at least one before publishing." : ""}</p>}
          <ActionForm action={addRequirement} submit="Add document" className="mt-4 grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" buttonClass="btn-primary btn-sm">
            {hidden}
            <div><label className="label" htmlFor="rq-l">Document</label><input id="rq-l" name="label" className="input" placeholder="e.g. Passport copy" required maxLength={150} /></div>
            <div><label className="label" htmlFor="rq-n">Note for applicants (optional)</label><input id="rq-n" name="note" className="input" placeholder="e.g. Valid for 6+ months" maxLength={300} /></div>
            <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="mandatory" defaultChecked className="size-4 accent-brand" /> Required</label>
          </ActionForm>
        </section>
      )}

      <section className="card p-6" aria-labelledby="hist">
        <h2 id="hist" className="text-xl">History</h2>
        <ol className="mt-3 space-y-1.5 text-sm">{history.map((h) => <li key={h.id} className="flex flex-wrap gap-x-3"><span className="w-40 shrink-0 muted">{dateTime(h.createdAt)}</span><span className="flex-1">{h.summary}</span></li>)}</ol>
        {!history.length && <p className="mt-2 text-sm muted">No changes recorded since the system started.</p>}
      </section>
    </div>
  );
}
