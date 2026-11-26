import Link from "next/link";
import { and, asc, eq, inArray, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { countryName } from "@/lib/locations";
import { date } from "@/lib/format";
import { nowMs } from "@/lib/finance";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { reviewGuidance } from "../actions";

export const metadata = { title: "Visa guidance review" };

export default async function VisaReview() {
  const now = nowMs();
  const stale = new Date(now - STALE_AFTER_DAYS * 86_400_000);
  const soon = new Date(now - (STALE_AFTER_DAYS - 30) * 86_400_000);
  const rows = await db.query.visaGuidance.findMany({
    where: and(inArray(s.visaGuidance.status, ["PUBLISHED", "DRAFT"]), or(eq(s.visaGuidance.reviewState, "NEEDS_REVIEW"), lt(s.visaGuidance.lastCheckedAt, soon))),
    orderBy: [asc(s.visaGuidance.lastCheckedAt)], with: { category: { columns: { name: true } } },
  });
  return (
    <div className="grid gap-4">
      <div><h1 className="text-3xl">Visa guidance review</h1><p className="mt-1 max-w-2xl text-sm muted">Entries flagged for review, or not checked against their official source for {STALE_AFTER_DAYS} days, are hidden from the visa checker and visitors are offered a consultation instead. Entries due within 30 days are listed too.</p></div>
      {rows.map((g) => {
        const overdue = g.reviewState === "NEEDS_REVIEW" || +g.lastCheckedAt < +stale;
        return (
          <article key={g.id} className={`card p-5 ${overdue ? "border-amber-300" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><Link href={`/staff/content/visa-guidance/${g.id}`} className="font-semibold text-brand underline">{g.title}</Link><p className="text-sm muted">{countryName(g.destinationIso)}{g.destinationCity ? `, ${g.destinationCity}` : ""} · {g.category.name} · {g.status === "DRAFT" ? "Draft" : "Published"}</p></div>
              <span className={`badge ${overdue ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{g.reviewState === "NEEDS_REVIEW" ? "Flagged for review" : overdue ? `Not checked since ${date(g.lastCheckedAt)}` : `Due soon (checked ${date(g.lastCheckedAt)})`}</span>
            </div>
            <p className="mt-2 text-sm">Source: <a className="text-brand underline" href={g.sourceUrl} target="_blank" rel="noopener noreferrer">{g.sourceName} ↗</a></p>
            <ActionForm action={reviewGuidance} submit="Mark as checked today" className="mt-3 flex flex-wrap items-center gap-3" buttonClass="btn-primary btn-sm">
              <input type="hidden" name="id" value={g.id} /><input type="hidden" name="op" value="checked" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="size-4 accent-brand" /> I compared it with {g.sourceName} today and updated anything that changed</label>
            </ActionForm>
          </article>
        );
      })}
      {!rows.length && <Empty title="All visa guidance is up to date" />}
    </div>
  );
}
