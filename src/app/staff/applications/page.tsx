import Link from "next/link";
import { and, desc, eq, ilike, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGES, STAGE_LABEL, SERVICE_LABEL, date, label, money } from "@/lib/format";
import { balanceOf, fromCents, nowMs } from "@/lib/finance";
import { clearance } from "@/components/clearance-badge";
import { Empty } from "@/components/cards";
import { assignConsultant } from "../actions";

export const metadata = { title: "Applications" };

export default async function StaffApplications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE"], "/staff/applications");
  const sp = await searchParams;
  const finance = user.role !== "CONSULTANT";
  const stage = STAGES.includes(sp.stage as (typeof STAGES)[number]) ? (sp.stage as (typeof STAGES)[number]) : undefined;
  const closed = sp.status === "closed";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const w: SQL[] = [closed ? ne(s.applications.status, "ACTIVE") : eq(s.applications.status, "ACTIVE")];
  if (user.role === "CONSULTANT") w.push(eq(s.applications.consultantId, user.id));
  if (stage) w.push(eq(s.applications.stage, stage));
  if (sp.unassigned === "1") w.push(isNull(s.applications.consultantId));
  if (sp.consultant && user.role === "ADMIN") w.push(eq(s.applications.consultantId, sp.consultant));
  if (q) w.push(or(ilike(s.applications.reference, `%${q.replace(/[%_\\]/g, "")}%`), inArray(s.applications.clientId, db.select({ id: s.users.id }).from(s.users).where(ilike(s.users.name, `%${q.replace(/[%_\\]/g, "")}%`))))!);
  const [rows, consultants] = await Promise.all([
    db.query.applications.findMany({ where: and(...w), orderBy: [desc(s.applications.createdAt)], limit: 300, with: { client: { columns: { name: true } }, consultant: { columns: { name: true } }, checklist: { columns: { state: true } }, invoices: { columns: { status: true, dueDate: true, amount: true, currency: true }, with: { payments: { columns: { amount: true } } } }, amendments: { columns: { status: true, source: true } } } }),
    user.role === "ADMIN" ? db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true))) : [],
  ]);
  const list = sp.check === "1" ? rows.filter((a) => a.checklist.some((c) => c.state === "UPLOADED")) : rows;
  const now = nowMs();
  const title = sp.check === "1" ? "Documents to check" : stage === "ELIGIBILITY_REVIEW" ? "Eligibility queue" : user.role === "CONSULTANT" ? "My applications" : "Applications";
  const keep = (extra: Record<string, string>) => { const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]); return `/staff/applications${p.size ? `?${p}` : ""}`; };
  return (
    <div className="grid gap-4">
      <h1 className="text-[clamp(26px,3vw,36px)]">{title}</h1>
      <form action="/staff/applications" className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-3">
        {sp.check && <input type="hidden" name="check" value={sp.check} />}
        <div className="min-w-48 flex-1"><label className="label" htmlFor="q">Search reference or client</label><input id="q" name="q" defaultValue={q} className="input min-h-10 py-1.5" /></div>
        <div><label className="label" htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={stage ?? ""} className="input min-h-10 py-1.5"><option value="">All stages</option>{STAGES.map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}</select></div>
        <div><label className="label" htmlFor="status">Showing</label><select id="status" name="status" defaultValue={closed ? "closed" : ""} className="input min-h-10 py-1.5"><option value="">Active</option><option value="closed">Completed or closed</option></select></div>
        {user.role === "ADMIN" && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="unassigned" value="1" defaultChecked={sp.unassigned === "1"} className="size-4 accent-brand" /> Unassigned only</label>}
        <button className="btn-primary btn-sm">Apply</button>
        {(q || stage || closed || sp.unassigned) && <Link href={keep({ q: "", stage: "", status: "", unassigned: "" })} className="btn-ghost btn-sm">Clear</Link>}
      </form>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead><tr className="border-b border-line text-xs muted"><th className="px-3 py-2">Reference</th><th className="px-3">Client</th><th className="px-3">Service</th><th className="px-3">Stage</th><th className="px-3">Payment</th>{finance && <th className="px-3 text-right">Outstanding</th>}<th className="px-3">Consultant</th><th className="px-3">Opened</th></tr></thead>
          <tbody>
            {list.map((a) => {
              const [ct, cc] = clearance(a.invoices, now);
              const toCheck = a.checklist.filter((c) => c.state === "UPLOADED").length;
              const changes = a.amendments.filter((m) => m.source === "CLIENT" && m.status === "REQUESTED").length;
              const due = new Map<string, number>();
              for (const i of a.invoices) if (i.status !== "VOID") due.set(i.currency, (due.get(i.currency) ?? 0) + balanceOf(i).due);
              return (
                <tr key={a.id} className="border-b border-line align-top last:border-0">
                  <td className="px-3 py-3"><Link className="font-semibold text-brand underline" href={`/staff/applications/${a.id}`}>{a.reference}</Link><p className="max-w-56 text-xs muted">{(a.selection as { title: string }).title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{toCheck > 0 && user.role !== "FINANCE" && <span className="badge bg-blue-50 text-brand">{toCheck} to check</span>}{changes > 0 && <span className="badge bg-amber-50 text-amber-800">Change requested</span>}</div></td>
                  <td className="px-3 pt-3">{a.client.name}</td>
                  <td className="px-3 pt-3">{SERVICE_LABEL[a.service]}</td>
                  <td className="px-3 pt-3"><span className="badge bg-brand/10 text-brand">{a.status === "ACTIVE" ? STAGE_LABEL[a.stage] : label(a.status)}</span></td>
                  <td className="px-3 pt-3"><span className={`badge ${cc}`}>{ct}</span></td>
                  {finance && <td className="px-3 pt-3 text-right font-semibold">{[...due].filter(([, c]) => c > 0).map(([c, v]) => money(fromCents(v), c)).join(" + ") || "—"}</td>}
                  <td className="px-3 pt-2">{user.role === "ADMIN" && a.status === "ACTIVE" && !a.consultantId ? (
                    <form action={assignConsultant} className="flex gap-1.5">
                      <input type="hidden" name="applicationId" value={a.id} />
                      <label className="sr-only" htmlFor={`c-${a.id}`}>Consultant for {a.reference}</label>
                      <select id={`c-${a.id}`} name="consultantId" defaultValue={a.consultantId ?? ""} className="input min-h-9 py-1 text-sm" required><option value="" disabled>Choose…</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                      <button className="btn-primary btn-sm">Assign</button>
                    </form>) : <span className="inline-block pt-1">{a.consultant?.name ?? "Unassigned"}{user.role === "ADMIN" && a.consultantId && a.status === "ACTIVE" && <Link className="ml-2 text-xs text-brand underline" href={`/staff/applications/${a.id}#assignment`}>Change</Link>}</span>}</td>
                  <td className="px-3 pt-3">{date(a.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <div className="p-3"><Empty title="No applications match" /></div>}
      </div>
    </div>
  );
}
