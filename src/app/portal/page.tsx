import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date, dateTime, label } from "@/lib/format";
import { Empty } from "@/components/cards";
import { StageTracker } from "@/components/stage-tracker";
import { markNotificationsRead } from "@/app/staff/actions";

export const metadata = { title: "My applications" };

export default async function Portal() {
  const user = await requireUser(undefined, "/portal");
  if (user.role !== "CLIENT") redirect("/staff");
  const [apps, notes] = await Promise.all([
    db.query.applications.findMany({ where: eq(s.applications.clientId, user.id), orderBy: [desc(s.applications.createdAt)], with: { consultant: { columns: { name: true } }, checklist: { columns: { state: true, mandatory: true } } } }),
    db.select().from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt))).orderBy(desc(s.notifications.createdAt)).limit(5),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl">Hello, {user.name.split(" ")[0]}</h1><div className="flex gap-2"><Link href="/work" className="btn-ghost btn-sm">Find a job</Link><Link href="/study" className="btn-ghost btn-sm">Find a program</Link><Link href="/visa" className="btn-ghost btn-sm">Check a visa</Link></div></div>
        <div className="mt-5 grid gap-4">
          {apps.map((a) => {
            const sel = a.selection as { title: string };
            const need = a.checklist.filter((c) => c.mandatory && !["UPLOADED", "VERIFIED"].includes(c.state)).length;
            return (
              <Link key={a.id} href={`/portal/applications/${a.id}`} className="card-link p-5">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="eyebrow">{SERVICE_LABEL[a.service]} · {a.reference}</p><h2 className="mt-1 text-xl">{sel.title}</h2><p className="text-sm muted">Submitted {date(a.createdAt)} · Consultant: {a.consultant?.name ?? "being assigned"}</p></div><span className="badge bg-gold/25 text-ink">{a.status === "ACTIVE" ? STAGE_LABEL[a.stage] : label(a.status)}</span></div>
                <div className="mt-4"><StageTracker stage={a.stage} status={a.status} /></div>
                {need > 0 && <p className="mt-3 text-sm font-semibold text-amber-800">{need} required document{need === 1 ? "" : "s"} to upload</p>}
              </Link>
            );
          })}
          {!apps.length && <Empty title="No applications yet">Browse <Link className="text-brand underline" href="/work">jobs</Link>, <Link className="text-brand underline" href="/study">programs</Link> or <Link className="text-brand underline" href="/visa">visa requirements</Link> to start.</Empty>}
        </div>
      </div>
      <aside className="card h-fit p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Latest notifications</h2>{notes.length > 0 && <form action={markNotificationsRead}><button className="text-sm font-medium text-brand hover:underline">Mark as read</button></form>}</div>
        <ul className="mt-3 space-y-3">{notes.map((n) => <li key={n.id} className="rounded-xl bg-mist p-3"><p className="font-semibold">{n.link ? <Link className="text-brand underline" href={n.link}>{n.title}</Link> : n.title}</p><p className="text-sm">{n.body}</p><p className="mt-1 text-xs muted">{dateTime(n.createdAt)}</p></li>)}</ul>
        {!notes.length && <p className="mt-3 text-sm muted">You&apos;re all caught up.</p>}
      </aside>
    </div>
  );
}
