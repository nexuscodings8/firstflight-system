import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date, dateTime, label } from "@/lib/format";
import { assignConsultant } from "./actions";
import { Empty } from "@/components/cards";

export const metadata = { title: "Staff dashboard" };

export default async function Staff() {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff");
  const where = user.role === "CONSULTANT" ? eq(s.applications.consultantId, user.id) : undefined;
  const showApps = user.role === "ADMIN" || user.role === "CONSULTANT" || user.role === "FINANCE";
  const [apps, consultants, enquiries, notes] = await Promise.all([
    showApps ? db.query.applications.findMany({ where, orderBy: [desc(s.applications.createdAt)], with: { client: { columns: { name: true } }, consultant: { columns: { name: true } } } }) : [],
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true))),
    user.role === "ADMIN" || user.role === "CONSULTANT" ? db.select().from(s.enquiries).where(eq(s.enquiries.status, "NEW")).orderBy(desc(s.enquiries.createdAt)).limit(10) : [],
    db.select().from(s.notifications).where(or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role)))).orderBy(desc(s.notifications.createdAt)).limit(6),
  ]);
  const unassigned = apps.filter((a) => !a.consultantId);
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Welcome, {user.name.split(" ")[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Applications", apps.length], ["Awaiting assignment", unassigned.length], ["New enquiries", enquiries.length]].map(([k, v]) => <div key={k} className="card p-5"><p className="text-sm muted">{k}</p><p className="font-display text-3xl font-extrabold">{v}</p></div>)}
      </div>
      {showApps && (
        <section className="card p-5">
          <h2 className="text-xl">{user.role === "CONSULTANT" ? "My assigned applications" : "Applications"}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs muted"><th className="py-2 pr-3">Reference</th><th className="pr-3">Client</th><th className="pr-3">Service</th><th className="pr-3">Stage</th><th className="pr-3">Submitted</th><th className="pr-3">Consultant</th></tr></thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-3 pr-3"><Link className="font-semibold text-brand underline" href={`/staff/applications/${a.id}`}>{a.reference}</Link><p className="text-xs muted">{(a.selection as { title: string }).title}</p></td>
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
        {enquiries.length > 0 && <section className="card p-5"><h2 className="text-xl">New enquiries</h2><ul className="mt-3 divide-y divide-line">{enquiries.map((e) => <li key={e.id} className="py-3"><p className="text-sm font-semibold">{e.reference} · {label(e.type)} · {e.name}</p><p className="text-sm">{e.message}</p><p className="text-xs muted">{e.email} · {dateTime(e.createdAt)}</p></li>)}</ul></section>}
        <section className="card p-5"><h2 className="text-xl">Notifications</h2><ul className="mt-3 space-y-2">{notes.map((n) => <li key={n.id} className="rounded-xl bg-mist p-3 text-sm"><p className="font-semibold">{n.title}</p><p>{n.body}</p><p className="text-xs muted">{dateTime(n.createdAt)}</p></li>)}</ul>{!notes.length && <p className="mt-2 text-sm muted">Nothing new.</p>}</section>
      </div>
      {(user.role === "FINANCE" || user.role === "CONTENT_MANAGER") && <p className="rounded-2xl bg-gold/15 p-4 text-sm">{user.role === "FINANCE" ? "Invoices, payments and receipts arrive in Phase 2." : "Content management (countries, jobs, programs, visa guidance, promotions, news) arrives in Phase 3."}</p>}
    </div>
  );
}
