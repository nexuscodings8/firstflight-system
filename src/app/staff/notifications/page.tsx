import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { markNotificationsRead } from "../actions";
import { Empty } from "@/components/cards";

export const metadata = { title: "Notifications" };

export default async function StaffNotifications({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const me = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff/notifications");
  const unreadOnly = (await searchParams).show !== "all";
  const mine = or(eq(s.notifications.userId, me.id), and(isNull(s.notifications.userId), eq(s.notifications.role, me.role)));
  const rows = await db.select().from(s.notifications).where(unreadOnly ? and(mine, isNull(s.notifications.readAt)) : mine).orderBy(desc(s.notifications.createdAt)).limit(150);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[clamp(26px,3vw,36px)]">Notifications</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Filter" className="flex gap-1 text-sm">{[["unread", "Unread"], ["all", "All"]].map(([k, t]) => <Link key={k} href={`/staff/notifications?show=${k}`} aria-current={(k === "all") === !unreadOnly ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${(k === "all") === !unreadOnly ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{t}</Link>)}</nav>
          <form action={markNotificationsRead}><button className="btn-ghost btn-sm">Mark all as read</button></form>
        </div>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {rows.map((n) => (
          <li key={n.id} className={`px-5 py-3.5 ${n.readAt ? "" : "border-l-4 border-l-gold bg-gold/[.08]"}`}>
            <p className="font-semibold">{n.link ? <Link href={n.link} className="hover:text-brand hover:underline">{n.title}</Link> : n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</p>
            <p className="text-sm">{n.body}</p><p className="text-xs muted">{dateTime(n.createdAt)}{n.userId ? "" : " · for your whole department"}</p>
          </li>
        ))}
      </ul>
      {!rows.length && <Empty title={unreadOnly ? "You're all caught up" : "No notifications yet"} />}
    </div>
  );
}
