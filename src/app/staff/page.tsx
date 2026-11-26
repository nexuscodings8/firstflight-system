import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date, dateTime, label, money } from "@/lib/format";
import { balanceOf, currentMonth, fromCents, monthRange, nowMs, toCents } from "@/lib/finance";
import { Kpi, KpiRow } from "@/components/shell/app-shell";
import { Empty } from "@/components/cards";
import { markNotificationsRead } from "./actions";

export const metadata = { title: "Overview" };
const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
const H1 = ({ children }: { children: React.ReactNode }) => <h1 className="text-[clamp(26px,3vw,36px)]">{children}</h1>;

async function Notes({ user }: { user: CurrentUser }) {
  const notes = await db.select().from(s.notifications).where(and(isNull(s.notifications.readAt), or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role))))).orderBy(desc(s.notifications.createdAt)).limit(8);
  return (
    <section className="card p-5" aria-labelledby="nt-h">
      <div className="flex items-center justify-between gap-2"><h2 id="nt-h" className="text-xl">Notifications</h2>{notes.length > 0 && <form action={markNotificationsRead}><button className="text-sm font-medium text-brand hover:underline">Mark all as read</button></form>}</div>
      <ul className="mt-3 divide-y divide-line">{notes.map((x) => <li key={x.id} className="py-2.5 text-sm"><p className="font-semibold">{x.link ? <Link className="text-brand underline" href={x.link}>{x.title}</Link> : x.title}</p><p>{x.body}</p><p className="text-xs muted">{dateTime(x.createdAt)}</p></li>)}</ul>
      {!notes.length && <p className="mt-2 text-sm muted">Nothing new.</p>}
    </section>
  );
}

/** Applications needing someone's attention, as a compact table. */
function Queue({ title, rows, empty, more }: { title: string; rows: { id: string; reference: string; service: "WORK" | "STUDY" | "VISA"; stage: string; status: string; createdAt: Date; client: { name: string }; note?: string }[]; empty: string; more: string }) {
  return (
    <section className="card p-5" aria-label={title}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-xl">{title}</h2><Link href={more} className="text-sm font-medium text-brand hover:underline">See all</Link></div>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-3">Application</th><th className="pr-3">Client</th><th className="pr-3">Service</th><th className="pr-3">Stage</th><th>Why</th></tr></thead>
          <tbody>{rows.map((a) => <tr key={a.id} className="border-b border-line last:border-0"><td className="py-2.5 pr-3"><Link className="font-semibold text-brand underline" href={`/staff/applications/${a.id}`}>{a.reference}</Link></td><td className="pr-3">{a.client.name}</td><td className="pr-3">{SERVICE_LABEL[a.service]}</td><td className="pr-3">{a.status === "ACTIVE" ? STAGE_LABEL[a.stage as "SUBMITTED"] : label(a.status)}</td><td className="muted">{a.note ?? `Opened ${date(a.createdAt)}`}</td></tr>)}</tbody>
        </table></div>
      ) : <p className="mt-2 text-sm muted">{empty}</p>}
    </section>
  );
}

/** Payments received this month by service, as bars (per currency). */
async function CollectedByService() {
  const [a, b] = monthRange(currentMonth())!;
  const rows = await db.select({ amount: s.payments.amount, currency: s.invoices.currency, service: s.applications.service }).from(s.payments)
    .innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId)).innerJoin(s.applications, eq(s.applications.id, s.invoices.applicationId))
    .where(and(gte(s.payments.paidAt, a), lt(s.payments.paidAt, b)));
  const by = new Map<string, number>();
  for (const r of rows) by.set(`${r.service}|${r.currency}`, (by.get(`${r.service}|${r.currency}`) ?? 0) + toCents(r.amount));
  const max = new Map<string, number>();
  for (const [k, v] of by) { const c = k.split("|")[1]; max.set(c, Math.max(max.get(c) ?? 0, v)); }
  const lines = (["WORK", "STUDY", "VISA"] as const).flatMap((svc) => { const e = [...by].filter(([k]) => k.startsWith(svc)); return e.length ? e.map(([k, v]) => ({ svc, cur: k.split("|")[1], v })) : [{ svc, cur: "", v: 0 }]; });
  return (
    <section className="card p-5" aria-labelledby="cbs-h">
      <h2 id="cbs-h" className="text-xl">Collected this month by service</h2>
      <ul className="mt-3 grid gap-2.5">{lines.map((l) => (
        <li key={l.svc + l.cur} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
          <span>{SERVICE_LABEL[l.svc]}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#04429f,#2f72d8)]" style={{ width: `${l.cur ? (l.v / (max.get(l.cur) || 1)) * 100 : 0}%` }} /></span>
          <b className="text-right">{l.cur ? money(fromCents(l.v), l.cur) : "—"}</b>
        </li>))}</ul>
      <Link href={`/staff/finance/report?month=${currentMonth()}`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Monthly report</Link>
    </section>
  );
}

const sumByCurrency = (rows: { amount: string; currency: string; status: string; payments: { amount: string }[] }[], k: "due" | "paid") => {
  const m = new Map<string, number>();
  for (const r of rows) if (r.status !== "VOID") m.set(r.currency, (m.get(r.currency) ?? 0) + balanceOf(r)[k]);
  return [...m].filter(([, v]) => v > 0).map(([c, v]) => money(fromCents(v), c)).join(" + ") || money(0, "USD");
};

export default async function Overview() {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff");
  if (user.role === "CONTENT_MANAGER") redirect("/staff/content");
  const first = user.name.split(" ")[0];
  const base = { client: { columns: { name: true } } } as const;

  if (user.role === "CONSULTANT") {
    const mine = and(eq(s.applications.consultantId, user.id), eq(s.applications.status, "ACTIVE"));
    const apps = await db.query.applications.findMany({ where: mine, orderBy: [asc(s.applications.createdAt)], with: { ...base, checklist: { columns: { state: true } }, amendments: { columns: { status: true } } } });
    const enq = await n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW")));
    const attention = apps.map((a) => {
      const check = a.checklist.filter((c) => c.state === "UPLOADED").length, change = a.amendments.some((m) => m.status === "REQUESTED");
      return { ...a, note: check ? `${check} document${check === 1 ? "" : "s"} to check` : change ? "Change requested" : a.stage === "ELIGIBILITY_REVIEW" ? "Eligibility to decide" : undefined };
    }).filter((a) => a.note);
    return (
      <div className="grid gap-5">
        <H1>Welcome, {first}</H1>
        <KpiRow>
          <Kpi label="My active applications" value={apps.length} icon="file" href="/staff/applications" />
          <Kpi label="Eligibility queue" value={apps.filter((a) => a.stage === "ELIGIBILITY_REVIEW").length} icon="checkcircle" tone={1} href="/staff/applications?stage=ELIGIBILITY_REVIEW" />
          <Kpi label="Documents to check" value={apps.reduce((x, a) => x + a.checklist.filter((c) => c.state === "UPLOADED").length, 0)} icon="doc" tone={2} href="/staff/applications?check=1" />
          <Kpi label="New enquiries" value={enq} icon="msg" tone={3} href="/staff/enquiries?show=new" />
        </KpiRow>
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><Queue title="Needs your attention" rows={attention} empty="Nothing is waiting for you." more="/staff/applications" /><Notes user={user} /></div>
      </div>
    );
  }

  if (user.role === "FINANCE") {
    const now = new Date(nowMs());
    const [open, refunds, monthPays] = await Promise.all([
      db.query.invoices.findMany({ where: inArray(s.invoices.status, ["ISSUED", "PARTIALLY_PAID"]), orderBy: [asc(s.invoices.dueDate)], with: { payments: { columns: { amount: true } }, application: { columns: { id: true, reference: true }, with: base } } }),
      n(db.select({ n: count() }).from(s.refundRequests).where(inArray(s.refundRequests.status, ["REQUESTED", "FORM_SUBMITTED"]))),
      (async () => { const [a, b] = monthRange(currentMonth())!; return db.select({ amount: s.payments.amount, currency: s.invoices.currency }).from(s.payments).innerJoin(s.invoices, eq(s.invoices.id, s.payments.invoiceId)).where(and(gte(s.payments.paidAt, a), lt(s.payments.paidAt, b))); })(),
    ]);
    const collected = new Map<string, number>();
    for (const p of monthPays) collected.set(p.currency, (collected.get(p.currency) ?? 0) + toCents(p.amount));
    const overdue = open.filter((i) => i.dueDate && +i.dueDate < +now);
    return (
      <div className="grid gap-5">
        <H1>Finance overview</H1>
        <KpiRow>
          <Kpi label="Overdue invoices" value={overdue.length} icon="card" href="/staff/finance" />
          <Kpi label="Collected this month" value={[...collected].map(([c, v]) => money(fromCents(v), c)).join(" + ") || money(0, "USD")} icon="wallet" tone={1} href="/staff/finance/report" />
          <Kpi label="Outstanding" value={sumByCurrency(open, "due")} icon="receipt" tone={2} href="/staff/finance" />
          <Kpi label="Refunds to handle" value={refunds} icon="refund" tone={3} href="/staff/finance/refunds" />
        </KpiRow>
        <div className="grid gap-5 xl:grid-cols-2">
          <CollectedByService />
          <section className="card p-5" aria-labelledby="due-h">
            <div className="flex items-center justify-between gap-2"><h2 id="due-h" className="text-xl">Payment queue</h2><Link href="/staff/finance" className="text-sm font-medium text-brand hover:underline">All balances</Link></div>
            {open.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-2">Application</th><th className="pr-2">Client</th><th className="pr-2">Due</th><th className="text-right">Balance</th></tr></thead>
              <tbody>{open.slice(0, 8).map((i) => <tr key={i.id} className="border-b border-line last:border-0"><td className="py-2.5 pr-2"><Link className="font-semibold text-brand underline" href={`/staff/applications/${i.application.id}`}>{i.application.reference}</Link><p className="text-xs muted">{i.number}</p></td><td className="pr-2">{i.application.client.name}</td><td className={`pr-2 ${i.dueDate && +i.dueDate < +now ? "font-semibold text-red-700" : ""}`}>{date(i.dueDate)}</td><td className="text-right font-semibold">{money(fromCents(balanceOf(i).due), i.currency)}</td></tr>)}</tbody>
            </table></div> : <p className="mt-2 text-sm muted">Nothing outstanding.</p>}
          </section>
        </div>
        <Notes user={user} />
      </div>
    );
  }

  // ADMIN
  const [unassigned, active, open, enq] = await Promise.all([
    db.query.applications.findMany({ where: and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE")), orderBy: [asc(s.applications.createdAt)], with: base, limit: 8 }),
    n(db.select({ n: count() }).from(s.applications).where(eq(s.applications.status, "ACTIVE"))),
    db.query.invoices.findMany({ where: inArray(s.invoices.status, ["ISSUED", "PARTIALLY_PAID"]), columns: { amount: true, currency: true, status: true }, with: { payments: { columns: { amount: true } } } }),
    n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW"))),
  ]);
  const emailOff = !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return (
    <div className="grid gap-5">
      <H1>Welcome, {first}</H1>
      {emailOff && <p className="rounded-2xl border border-gold/60 bg-gold/15 p-4 text-sm">Email notifications are not connected yet, so clients and staff see notifications only inside the system. See <Link className="font-semibold text-brand underline" href="/staff/launch">Launch checks</Link>.</p>}
      <KpiRow>
        <Kpi label="Awaiting assignment" value={unassigned.length} icon="users" href="/staff/applications?unassigned=1" />
        <Kpi label="Active applications" value={active} icon="file" tone={1} href="/staff/applications" />
        <Kpi label="Outstanding" value={sumByCurrency(open, "due")} icon="receipt" tone={2} href="/staff/finance" />
        <Kpi label="New enquiries" value={enq} icon="msg" tone={3} href="/staff/enquiries?show=new" />
      </KpiRow>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Queue title="Awaiting a consultant" rows={unassigned.map((a) => ({ ...a, note: `Submitted ${date(a.createdAt)}` }))} empty="Every active application has a consultant." more="/staff/applications?unassigned=1" />
        <Notes user={user} />
      </div>
      <CollectedByService />
      {!unassigned.length && !active && <Empty title="No applications yet" />}
    </div>
  );
}
