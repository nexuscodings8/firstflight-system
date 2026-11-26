import Link from "next/link";
import { and, desc, gte, ilike, or, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateTime, label } from "@/lib/format";
import { Empty } from "@/components/cards";
import { nowMs } from "@/lib/finance";

export const metadata = { title: "Activity" };

// Which actions belong to which department, by action prefix.
const AREAS: Record<string, { text: string; prefixes: string[] }> = {
  cases: { text: "Applications and documents", prefixes: ["application.", "document.", "update.", "note."] },
  finance: { text: "Finance", prefixes: ["invoice.", "payment."] },
  enquiries: { text: "Enquiries", prefixes: ["enquiry."] },
  users: { text: "Accounts", prefixes: ["user."] },
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ area?: string; q?: string; days?: string }> }) {
  await requireUser(["ADMIN"], "/staff/activity");
  const sp = await searchParams;
  const area = AREAS[sp.area ?? ""] ? sp.area! : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const days = [1, 7, 30, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const conds: SQL[] = [gte(s.activities.createdAt, new Date(nowMs() - days * 86_400_000))];
  if (area) conds.push(or(...AREAS[area].prefixes.map((p) => ilike(s.activities.action, `${p}%`)))!);
  if (q) conds.push(ilike(s.activities.summary, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  const rows = await db.query.activities.findMany({ where: and(...conds), orderBy: [desc(s.activities.createdAt)], limit: 300, with: { actor: { columns: { name: true, role: true } } } });
  return (
    <div className="grid gap-5">
      <h1 className="text-[clamp(26px,3vw,36px)]">Activity</h1>
      <form className="card flex flex-wrap items-end gap-3 p-4" action="/staff/activity">
        <div><label className="label" htmlFor="ar">Area</label><select id="ar" name="area" defaultValue={area} className="input min-h-9 py-1"><option value="">Everything</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}</select></div>
        <div><label className="label" htmlFor="dy">Period</label><select id="dy" name="days" defaultValue={String(days)} className="input min-h-9 py-1"><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last year</option></select></div>
        <div className="min-w-56 flex-1"><label className="label" htmlFor="q">Search (name, reference, invoice…)</label><input id="q" name="q" defaultValue={q} className="input min-h-9 py-1" placeholder="e.g. FF-WA-2026-0001" /></div>
        <button className="btn-primary btn-sm">Filter</button>
      </form>
      <section className="card p-5">
        <p className="text-sm muted">{rows.length === 300 ? "Showing the latest 300 entries" : `${rows.length} entr${rows.length === 1 ? "y" : "ies"}`}</p>
        <ol className="mt-3 divide-y divide-line text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
              <span className="w-40 shrink-0 muted">{dateTime(a.createdAt)}</span>
              <span className="flex-1">{a.summary}{a.applicationId && <> · <Link className="text-brand underline" href={`/staff/applications/${a.applicationId}`}>open</Link></>}</span>
              <span className="text-xs muted">{a.actor ? `${a.actor.name} (${label(a.actor.role)})` : "Website visitor"}</span>
            </li>
          ))}
        </ol>
        {!rows.length && <Empty title="No activity matches" />}
      </section>
    </div>
  );
}
