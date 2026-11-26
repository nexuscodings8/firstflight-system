import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntity } from "@/lib/content/entities";
import { listRows, refOptions } from "@/lib/content/store";
import { countryName } from "@/lib/locations";
import { date, label } from "@/lib/format";
import { Empty } from "@/components/cards";
import { StatusBadge } from "@/components/content/status-badge";

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<{ status?: string; q?: string; deleted?: string }> }) {
  const e = getEntity((await params).entity);
  if (!e) notFound();
  const sp = await searchParams;
  const status = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(sp.status ?? "") ? sp.status : undefined;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const rows = await listRows(e, { status, q });
  const refs: Record<string, Map<string, string>> = {};
  for (const c of e.listColumns) if (c.ref) refs[c.field] = new Map((await refOptions(c.ref)).map((o) => [o.value, o.label]));
  const cell = (field: string, v: unknown) => {
    if (refs[field]) return refs[field].get(String(v)) ?? "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (v instanceof Date) return date(v);
    if (field.endsWith("Iso") && v) return countryName(String(v));
    if (typeof v === "string" && /^[A-Z_]+$/.test(v)) return label(v);
    return v == null || v === "" ? "—" : String(v);
  };
  const tabs: [string | undefined, string][] = [[undefined, "Live and drafts"], ["DRAFT", "Drafts"], ["PUBLISHED", "Published"], ["ARCHIVED", "Archived"]];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl">{e.plural}</h1>{e.help && <p className="mt-1 max-w-2xl text-sm muted">{e.help}</p>}</div>
        <Link href={`/staff/content/${e.key}/new`} className="btn-primary btn-sm">New {e.singular}</Link>
      </div>
      {sp.deleted && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Deleted &ldquo;{sp.deleted}&rdquo;.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {e.hasStatus && <nav aria-label="Filter by status" className="flex flex-wrap gap-1 text-sm">{tabs.map(([k, t]) => <Link key={t} href={`/staff/content/${e.key}${k ? `?status=${k}` : ""}`} aria-current={status === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${status === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{t}</Link>)}</nav>}
        <form className="flex gap-2" action={`/staff/content/${e.key}`}>{status && <input type="hidden" name="status" value={status} />}<label className="sr-only" htmlFor="q">Search {e.plural.toLowerCase()}</label><input id="q" name="q" defaultValue={q} placeholder="Search by name" className="input min-h-9 py-1" /><button className="btn-ghost btn-sm">Search</button></form>
      </div>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr className="border-b border-line text-xs muted"><th className="px-3 py-2">Name</th>{e.listColumns.map((c) => <th key={c.field} className="px-3">{c.label}</th>)}{e.hasStatus && <th className="px-3">Status</th>}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="px-3 py-2.5"><Link className="font-semibold text-brand underline" href={`/staff/content/${e.key}/${r.id}`}>{String(r[e.titleField])}</Link></td>
              {e.listColumns.map((c) => <td key={c.field} className="px-3">{cell(c.field, r[c.field])}</td>)}
              {e.hasStatus && <td className="px-3"><StatusBadge status={String(r.status)} /></td>}
            </tr>))}</tbody>
        </table>
        {!rows.length && <div className="p-3"><Empty title={q ? "Nothing matches your search" : `No ${e.plural.toLowerCase()} here yet`} /></div>}
      </div>
    </div>
  );
}
