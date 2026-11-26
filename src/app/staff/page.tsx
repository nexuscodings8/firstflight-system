import Link from "next/link";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date, dateTime, label } from "@/lib/format";
import { assignConsultant, markNotificationsRead } from "./actions";
import { Empty } from "@/components/cards";

export const metadata = { title: "Staff dashboard" };

export default async function Staff() {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff");
  const where = user.role === "CONSULTANT" ? eq(s.applications.consultantId, user.id) : undefined;
  const showApps = user.role === "ADMIN" || user.role === "CONSULTANT" || user.role === "FINANCE";
  const [apps, consultants, enquiries, notes] = await Promise.all([
    showApps ? db.query.applications.findMany({ where, orderBy: [desc(s.applications.createdAt)], with: { client: { columns: { name: true } }, consultant: { columns: { name: true } }, checklist: { columns: { state: true } }, invoices: { columns: { id: true } } } }) : [],
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true))),
    user.role === "ADMIN" || user.role === "CONSULTANT" ? db.select().from(s.enquiries).where(eq(s.enquiries.status, "NEW")).orderBy(desc(s.enquiries.createdAt)).limit(10) : [],
    db.select().from(s.notifications).where(and(isNull(s.notifications.readAt), or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role))))).orderBy(desc(s.notifications.createdAt)).limit(8),
  ]);
  const toCheck = user.role === "CONSULTANT" || user.role === "ADMIN"
    ? (await db.select({ id: s.checklistItems.id }).from(s.checklistItems).innerJoin(s.applications, eq(s.applications.id, s.checklistItems.applicationId))
      .where(and(eq(s.checklistItems.state, "UPLOADED"), eq(s.applications.status, "ACTIVE"), user.role === "CONSULTANT" ? eq(s.applications.consultantId, user.id) : undefined))).length
    : 0;
  const unassigned = apps.filter((a) => !a.consultantId && a.status === "ACTIVE");
  const unpaid = user.role === "FINANCE" || user.role === "ADMIN"
    ? (await db.select({ id: s.invoices.id }).from(s.invoices).where(inArray(s.invoices.status, ["ISSUED", "PARTIALLY_PAID"]))).length : 0;
  const active = apps.filter((a) => a.status === "ACTIVE").length;
  const tiles: [string, number, string][] =
    user.role === "FINANCE" ? [["Active applications", active, "/staff"], ["Unpaid invoices", unpaid, "/staff/finance"], ["Applications without an invoice", apps.filter((a) => a.status === "ACTIVE" && !a.invoices.length).length, "/staff"]]
      : user.role === "CONSULTANT" ? [["My active applications", active, "/staff"], ["Documents to check", toCheck, "/staff"], ["New enquiries", enquiries.length, "/staff/enquiries?show=new"]]
        : user.role === "ADMIN" ? [["Awaiting assignment", unassigned.length, "/staff"], ["Documents to check", toCheck, "/staff"], ["Unpaid invoices", unpaid, "/staff/finance"]]
          : [];
  const emailOff = user.role === "ADMIN" && !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Welcome, {user.name.split(" ")[0]}</h1>
      {emailOff && <p className="rounded-2xl bg-gold/15 p-4 text-sm">Email notifications are not connected yet, so clients and staff see notifications only inside the system. Add <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> on Render to switch email on.</p>}
      {tiles.length > 0 && <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(([k, v, h]) => <Link key={k} href={h} className="card-link p-5"><p className="text-sm muted">{k}</p><p className="font-display text-3xl font-extrabold">{v}</p></Link>)}
      </div>}
      {showApps && (
        <section className="card p-5">
          <h2 className="text-xl">{user.role === "CONSULTANT" ? "My assigned applications" : "Applications"}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-3">Reference</th><th className="pr-3">Client</th><th className="pr-3">Service</th><th className="pr-3">Stage</th><th className="pr-3">Submitted</th><th className="pr-3">Consultant</th></tr></thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-3 pr-3"><Link className="font-semibold text-brand underline" href={`/staff/applications/${a.id}`}>{a.reference}</Link><p className="text-xs muted">{(a.selection as { title: string }).title}</p>{(() => { const n = a.checklist.filter((c) => c.state === "UPLOADED").length; return n > 0 && user.role !== "FINANCE" ? <span className="badge mt-1 bg-blue-50 text-brand">{n} to check</span> : null; })()}</td>
                    <td className="pr-3 pt-3">{a.client.name}</td><td className="pr-3 pt-3">{SERVICE_LABEL[a.service]}</td>
                    <td className="pr-3 pt-3">{a.status === "ACTIVE" ? STAGE_LABEL[a.stage] : label(a.status)}</td><td className="pr-3 pt-3">{date(a.createdAt)}</td>
                    <td className="pr-3 pt-2">{user.role === "ADMIN" ? (
                      <form action={assignConsultant} className="flex gap-2">
                        <input type="hidden" name="applicationId" value={a.id} />
                        <label className="sr-only" htmlFor={`c-${a.id}`}>Consultant for {a.reference}</label>
                        <select id={`c-${a.id}`} name="consultantId" defaultValue={a.consultantId ?? ""} className="input min-h-9 py-1 text-sm" required><option value="" disabled>Choose…</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <button className="btn-primary btn-sm">{a.consultantId ? "Reassign" : "Assign"}</button>
                      </form>) : (a.consultant?.name ?? "Unassigned")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!apps.length && <Empty title="No applications yet" />}
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {enquiries.length > 0 && <section className="card p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-xl">New enquiries</h2><Link href="/staff/enquiries?show=new" className="text-sm font-medium text-brand hover:underline">Handle enquiries</Link></div><ul className="mt-3 divide-y divide-line">{enquiries.map((e) => <li key={e.id} className="py-3"><p className="text-sm font-semibold">{e.reference} · {label(e.type)} · {e.name}</p><p className="text-sm">{e.message}</p><p className="text-xs muted">{e.email} · {dateTime(e.createdAt)}</p></li>)}</ul></section>}
        <section className="card p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-xl">Notifications</h2>{notes.length > 0 && <form action={markNotificationsRead}><button className="text-sm font-medium text-brand hover:underline">Mark all as read</button></form>}</div><ul className="mt-3 space-y-2">{notes.map((n) => <li key={n.id} className="rounded-xl bg-mist p-3 text-sm"><p className="font-semibold">{n.link ? <Link className="text-brand underline" href={n.link}>{n.title}</Link> : n.title}</p><p>{n.body}</p><p className="text-xs muted">{dateTime(n.createdAt)}</p></li>)}</ul>{!notes.length && <p className="mt-2 text-sm muted">Nothing new.</p>}</section>
      </div>
      {user.role === "CONTENT_MANAGER" && <Link href="/staff/content" className="card-link p-5"><p className="font-semibold">Manage website content</p><p className="text-sm muted">Countries, jobs, universities and programs, visa guidance, promotions, portfolio, testimonials and news.</p></Link>}
    </div>
  );
}
