import { stepFacts } from "@/lib/applications";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { clientApps, totals } from "@/lib/client-data";
import { balanceOf, fromCents } from "@/lib/finance";
import { dateTime, money } from "@/lib/format";
import { nextStep } from "@/lib/next-step";
import { Kpi, KpiRow } from "@/components/shell/app-shell";
import { BoardingPass, PaidBar } from "@/components/boarding-pass";
import { StageTracker } from "@/components/stage-tracker";
import { Empty } from "@/components/cards";
import { markNotificationsRead } from "@/app/staff/actions";

export const metadata = { title: "Dashboard" };

export default async function Portal() {
  const user = await requireUser(["CLIENT"], "/portal");
  const [apps, notes] = await Promise.all([
    clientApps(user.id),
    db.select().from(s.notifications).where(eq(s.notifications.userId, user.id)).orderBy(desc(s.notifications.createdAt)).limit(6),
  ]);
  const unread = (await db.select({ id: s.notifications.id }).from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)))).length;
  const t = totals(apps);
  const main = apps.find((a) => a.status === "ACTIVE") ?? apps[0];
  const step = main ? nextStep({ ...main, ...stepFacts(main) }, "client") : undefined;
  return (
    <div className="grid gap-5">
      <h1 className="text-[clamp(26px,3vw,36px)]">Hello, {user.name.split(" ")[0]}</h1>
      <KpiRow>
        <Kpi label="Total service cost" value={t.total} icon="tag" href="/portal/payments" />
        <Kpi label="Paid" value={t.paid} icon="wallet" tone={1} href="/portal/payments" />
        <Kpi label="Outstanding" value={t.due} icon="receipt" tone={2} href="/portal/payments" />
        <Kpi label="Unread updates" value={unread} icon="bell" tone={3} href="/portal/notifications" />
      </KpiRow>
      {main ? (
        <>
          {(() => {
            const inv = main.invoices.filter((i) => i.status !== "VOID");
            const cur = inv[0]?.currency;
            const one = inv.every((i) => i.currency === cur);
            const paid = inv.reduce((n, i) => n + balanceOf(i).paid, 0), total = inv.reduce((n, i) => n + balanceOf(i).total, 0);
            return <BoardingPass app={main} href={`/portal/applications/${main.id}`} stub={inv.length && one ? <PaidBar paid={paid} total={total} text={`${money(fromCents(paid), cur)} of ${money(fromCents(total), cur)}`} /> : <span className="muted">No fees issued yet</span>} />;
          })()}
          <section className="card p-6" aria-label="Application progress"><StageTracker stage={main.stage} status={main.status} /></section>
          {step && <section className="rounded-2xl border border-line border-l-4 border-l-gold bg-white p-5 shadow-sm"><h2 className="text-lg">Next step</h2><p className="mt-1">{step}</p></section>}
          {apps.length > 1 && <p className="text-sm"><Link href="/portal/applications" className="font-semibold text-brand underline">See all {apps.length} applications</Link></p>}
        </>
      ) : (
        <Empty title="No applications yet">Start one from <Link className="text-brand underline" href="/portal/new">New application</Link>.</Empty>
      )}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-[clamp(22px,2.4vw,30px)]">Latest updates</h2>{unread > 0 && <form action={markNotificationsRead}><button className="text-sm font-medium text-brand hover:underline">Mark all as read</button></form>}</div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {notes.map((n) => (
            <li key={n.id} className={`px-4 py-3.5 ${n.readAt ? "" : "border-l-4 border-l-gold bg-gold/[.08]"}`}>
              <p className="font-semibold">{n.link ? <Link href={n.link} className="hover:text-brand hover:underline">{n.title}</Link> : n.title}</p>
              <p>{n.body}</p><p className="mt-0.5 text-sm muted">{dateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
        {!notes.length && <p className="mt-2 muted">No updates yet.</p>}
        {notes.length > 0 && <Link href="/portal/notifications" className="mt-2 inline-block text-sm font-semibold text-brand underline">All notifications</Link>}
      </section>
    </div>
  );
}
