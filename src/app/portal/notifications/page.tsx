import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { markNotificationsRead } from "@/app/staff/actions";
import { Empty } from "@/components/cards";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const user = await requireUser(["CLIENT"], "/portal/notifications");
  const [rows, unread] = await Promise.all([
    db.select().from(s.notifications).where(eq(s.notifications.userId, user.id)).orderBy(desc(s.notifications.createdAt)).limit(100),
    db.select({ id: s.notifications.id }).from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt))),
  ]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-[clamp(26px,3vw,36px)]">Notifications</h1>{unread.length > 0 && <form action={markNotificationsRead}><button className="btn-ghost btn-sm">Mark all as read</button></form>}</div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {rows.map((n) => (
          <li key={n.id} className={`px-5 py-4 ${n.readAt ? "" : "border-l-4 border-l-gold bg-gold/[.08]"}`}>
            <p className="font-semibold">{n.link ? <Link href={n.link} className="hover:text-brand hover:underline">{n.title}</Link> : n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</p>
            <p>{n.body}</p><p className="mt-0.5 text-sm muted">{dateTime(n.createdAt)}</p>
          </li>
        ))}
      </ul>
      {!rows.length && <Empty title="No notifications yet" />}
    </div>
  );
}
