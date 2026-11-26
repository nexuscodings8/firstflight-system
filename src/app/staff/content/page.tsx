import Link from "next/link";
import { and, eq, gt, lt, lte, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { ENTITIES, type Group } from "@/lib/content/entities";
import { statusCounts } from "@/lib/content/store";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";
import { nowMs } from "@/lib/finance";
import { date } from "@/lib/format";

export const metadata = { title: "Content" };

export default async function ContentHome() {
  const now = nowMs();
  const stale = new Date(now - STALE_AFTER_DAYS * 86_400_000);
  const soon = new Date(now + 7 * 86_400_000);
  const list = Object.values(ENTITIES);
  const [counts, review, ending] = await Promise.all([
    Promise.all(list.map((e) => statusCounts(e))),
    db.select({ id: s.visaGuidance.id }).from(s.visaGuidance).where(and(eq(s.visaGuidance.status, "PUBLISHED"), or(eq(s.visaGuidance.reviewState, "NEEDS_REVIEW"), lt(s.visaGuidance.lastCheckedAt, stale)))),
    db.select().from(s.promotions).where(and(eq(s.promotions.status, "PUBLISHED"), lte(s.promotions.startsAt, new Date(now)), gt(s.promotions.expiresAt, new Date(now)), lt(s.promotions.expiresAt, soon))),
  ]);
  return (
    <div className="grid gap-6">
      <div><h1 className="text-3xl">Website content</h1><p className="mt-1 muted">New items start as drafts. Visitors only see what is published; preview a draft before publishing it.</p></div>
      {(review.length > 0 || ending.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {review.length > 0 && <Link href="/staff/content/visa-review" className="card-link border-amber-300 bg-amber-50 p-5"><p className="font-semibold text-amber-900">{review.length} visa guidance entr{review.length === 1 ? "y needs" : "ies need"} checking</p><p className="text-sm text-amber-900">Visitors are offered a consultation instead of these checklists until they are checked.</p></Link>}
          {ending.length > 0 && <div className="card p-5"><p className="font-semibold">Promotions ending this week</p><ul className="mt-1 text-sm">{ending.map((p) => <li key={p.id}><Link className="text-brand underline" href={`/staff/content/promotions/${p.id}`}>{p.title}</Link> · until {date(p.expiresAt)}</li>)}</ul></div>}
        </div>
      )}
      {(["Catalogue", "Visa", "Website"] as Group[]).map((g) => (
        <section key={g}>
          <h2 className="text-xl">{g}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((e, i) => e.group !== g ? null : (
              <Link key={e.key} href={`/staff/content/${e.key}`} className="card-link p-4">
                <p className="font-semibold">{e.plural}</p>
                <p className="text-sm muted">{e.hasStatus ? `${counts[i].PUBLISHED ?? 0} published · ${counts[i].DRAFT ?? 0} draft${(counts[i].ARCHIVED ?? 0) ? ` · ${counts[i].ARCHIVED} archived` : ""}` : `${counts[i].total ?? 0} in total`}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
