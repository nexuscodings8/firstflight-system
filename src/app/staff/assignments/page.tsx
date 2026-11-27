import Link from "next/link";
import { and, asc, count, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGES, STAGE_LABEL, SERVICE_LABEL, date, dateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { decideRequest, directAssign } from "../assignment-actions";

export const metadata = { title: "Assignments" };
const TABS = { requests: "Pending requests", unassigned: "Unassigned clients", workload: "Workload", history: "History" } as const;

export default async function Assignments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(["ADMIN"], "/staff/assignments");
  const sp = await searchParams;
  const tab = (sp.tab && sp.tab in TABS ? sp.tab : "requests") as keyof typeof TABS;
  const service = ["WORK", "STUDY", "VISA"].includes(sp.service ?? "") ? (sp.service as "WORK") : undefined;
  const stage = STAGES.includes(sp.stage as "SUBMITTED") ? (sp.stage as "SUBMITTED") : undefined;
  const consultantF = sp.consultant || undefined;
  const consultants = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true))).orderBy(asc(s.users.name));
  const grants = await db.select().from(s.consultantServices);
  const holds = (id: string, sv: string) => grants.some((g) => g.userId === id && g.service === sv);
  const appWhere: SQL[] = [eq(s.applications.status, "ACTIVE")];
  if (service) appWhere.push(eq(s.applications.service, service));
  if (stage) appWhere.push(eq(s.applications.stage, stage));

  const tabs = (
    <nav aria-label="Assignment views" className="flex flex-wrap gap-1 text-sm">{(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => <Link key={k} href={`/staff/assignments?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{TABS[k]}</Link>)}</nav>
  );
  const filters = (
    <form action="/staff/assignments" className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-3">
      <input type="hidden" name="tab" value={tab} />
      <div><label className="label" htmlFor="f-service">Service</label><select id="f-service" name="service" defaultValue={service ?? ""} className="input min-h-10 py-1.5"><option value="">All</option>{(["WORK", "STUDY", "VISA"] as const).map((x) => <option key={x} value={x}>{SERVICE_LABEL[x]}</option>)}</select></div>
      <div><label className="label" htmlFor="f-stage">Stage</label><select id="f-stage" name="stage" defaultValue={stage ?? ""} className="input min-h-10 py-1.5"><option value="">All</option>{STAGES.map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}</select></div>
      <div><label className="label" htmlFor="f-cons">Consultant</label><select id="f-cons" name="consultant" defaultValue={consultantF ?? ""} className="input min-h-10 py-1.5"><option value="">All</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <button className="btn-primary btn-sm">Filter</button>
    </form>
  );

  let body: React.ReactNode = null;
  if (tab === "requests") {
    const reqs = await db.query.assignmentRequests.findMany({ where: and(eq(s.assignmentRequests.status, "PENDING"), consultantF ? eq(s.assignmentRequests.consultantId, consultantF) : undefined), orderBy: [asc(s.assignmentRequests.createdAt)], with: { consultant: { columns: { name: true } }, application: { with: { client: { columns: { name: true } } } } } });
    const list = reqs.filter((r) => (!service || r.application.service === service) && (!stage || r.application.stage === stage));
    body = list.length ? list.map((r) => (
      <article key={r.id} className="card p-5">
        <p className="font-semibold">{r.consultant.name} asks to serve <Link className="text-brand underline" href={`/staff/applications/${r.applicationId}`}>{r.application.reference}</Link> ({r.application.client.name})</p>
        <p className="text-sm muted">{SERVICE_LABEL[r.application.service]} · {STAGE_LABEL[r.application.stage]} · requested {dateTime(r.createdAt)}{r.application.consultantId ? " · already assigned" : ""}</p>
        {r.note && <p className="mt-1 text-sm">&ldquo;{r.note}&rdquo;</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ActionForm action={decideRequest} submit={`Approve: assign to ${r.consultant.name}`} className="grid gap-2"><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
          <ActionForm action={decideRequest} submit="Reject request" className="flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm"><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="reject" /><label className="sr-only" htmlFor={`rj-${r.id}`}>Reason</label><input id={`rj-${r.id}`} name="note" className="input min-h-9 flex-1 py-1.5 text-sm" placeholder="Reason (shown to the consultant)" /></ActionForm>
        </div>
      </article>
    )) : <Empty title="No pending requests" />;
  } else if (tab === "unassigned") {
    const apps = await db.query.applications.findMany({ where: and(...appWhere, isNull(s.applications.consultantId)), orderBy: [asc(s.applications.createdAt)], with: { client: { columns: { name: true } }, assignmentRequests: { where: eq(s.assignmentRequests.status, "PENDING"), with: { consultant: { columns: { name: true } } } } } });
    body = apps.length ? apps.map((a) => (
      <article key={a.id} className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-semibold"><Link className="text-brand underline" href={`/staff/applications/${a.id}`}>{a.reference}</Link> · {a.client.name}</p><p className="text-sm muted">{SERVICE_LABEL[a.service]} · {(a.selection as { title: string }).title} · submitted {date(a.createdAt)}</p></div>
          <span className={`badge ${a.assignmentRequests.length ? "bg-blue-50 text-brand" : "bg-amber-50 text-amber-800"}`}>{a.assignmentRequests.length ? `Request pending (${a.assignmentRequests.map((r) => r.consultant.name).join(", ")})` : "Unassigned"}</span>
        </div>
        <ActionForm action={directAssign} submit="Assign now" className="mt-3 flex flex-wrap items-end gap-2" buttonClass="btn-primary btn-sm">
          <input type="hidden" name="applicationId" value={a.id} />
          <div><label className="label" htmlFor={`as-${a.id}`}>Consultant</label><select id={`as-${a.id}`} name="consultantId" required defaultValue="" className="input min-h-9 py-1 text-sm"><option value="" disabled>Choose…</option>{consultants.filter((c) => holds(c.id, a.service)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </ActionForm>
      </article>
    )) : <Empty title="Every active client has a consultant" />;
  } else if (tab === "workload") {
    const rows = await db.select({ id: s.applications.consultantId, n: count() }).from(s.applications).where(and(...appWhere)).groupBy(s.applications.consultantId);
    body = (
      <div className="card overflow-x-auto p-2"><table className="w-full min-w-[560px] text-left text-sm">
        <thead><tr className="border-b border-line text-xs muted"><th className="px-3 py-2">Consultant</th><th className="px-3">Services</th><th className="px-3 text-right">Active applications</th><th className="px-3" /></tr></thead>
        <tbody>{consultants.map((c) => { const n = rows.find((r) => r.id === c.id)?.n ?? 0; return <tr key={c.id} className="border-b border-line last:border-0"><td className="px-3 py-2.5 font-semibold">{c.name}</td><td className="px-3">{grants.filter((g) => g.userId === c.id).map((g) => SERVICE_LABEL[g.service] ?? "Flights").join(", ") || "None"}</td><td className="px-3 text-right font-display text-lg font-bold">{n}</td><td className="px-3 text-right"><Link className="text-brand underline" href={`/staff/applications?consultant=${c.id}`}>View clients</Link></td></tr>; })}
          <tr><td className="px-3 py-2.5 font-semibold">Unassigned</td><td /><td className="px-3 text-right font-display text-lg font-bold">{rows.find((r) => r.id === null)?.n ?? 0}</td><td className="px-3 text-right"><Link className="text-brand underline" href="/staff/assignments?tab=unassigned">Assign</Link></td></tr>
        </tbody></table></div>
    );
  } else {
    const hist = await db.query.assignmentHistory.findMany({ orderBy: [desc(s.assignmentHistory.createdAt)], limit: 200, where: consultantF ? inArray(s.assignmentHistory.applicationId, db.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.consultantId, consultantF))) : undefined,
      with: { from: { columns: { name: true } }, to: { columns: { name: true } }, changedBy: { columns: { name: true } }, application: { columns: { id: true, reference: true, service: true } } } });
    body = (
      <ol className="card divide-y divide-line p-2 text-sm">{hist.filter((h) => !service || h.application.service === service).map((h) => (
        <li key={h.id} className="flex flex-wrap gap-x-4 px-3 py-2.5"><span className="w-40 shrink-0 muted">{dateTime(h.createdAt)}</span>
          <span className="flex-1"><Link className="font-semibold text-brand underline" href={`/staff/applications/${h.application.id}`}>{h.application.reference}</Link>: {h.kind === "UNASSIGNED" ? `removed from ${h.from?.name}` : `${h.from ? `${h.from.name} → ` : ""}${h.to?.name}`}{h.kind === "REQUEST_APPROVED" ? " (request approved)" : ""}{h.reason ? ` · ${h.reason}` : ""}</span>
          <span className="muted">{h.changedBy?.name ?? "System"}</span></li>))}</ol>
    );
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-[clamp(26px,3vw,36px)]">Assignments</h1>
      {tabs}
      {tab !== "workload" && filters}
      <div className="grid gap-3">{body}</div>
    </div>
  );
}
