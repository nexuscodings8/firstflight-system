// Notifications shown inside the section they're about (Payments, Contracts, Visa processing…), with date, time,
// read/unread state and a link. The notification center still lists everything.
import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { sectionOf, applicationOf, type Section } from "@/lib/notice-sections";
import { dateTime } from "@/lib/format";
import { markNoticesRead } from "@/app/notice-actions";

/** Notifications older than this aren't repeated in the sections (the notification center keeps them all). */
const daysBack = (n: number) => new Date(new Date().getTime() - n * 86_400_000);

export async function SectionNotices({ user, sections, applicationId, path, limit = 4 }: { user: CurrentUser; sections: Section[]; applicationId?: string; path: string; limit?: number }) {
  const mine = user.role === "CLIENT" ? eq(s.notifications.userId, user.id) : or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role)));
  const since = daysBack(60);
  const rows = (await db.select().from(s.notifications).where(and(mine, gte(s.notifications.createdAt, since), or(inArray(s.notifications.section, sections), isNull(s.notifications.section)))).orderBy(desc(s.notifications.createdAt)).limit(200))
    .filter((n) => sections.includes((n.section as Section | null) ?? sectionOf(n.link, n.title)))
    .filter((n) => !applicationId || (n.applicationId ?? applicationOf(n.link)) === applicationId)
    .slice(0, limit);
  if (!rows.length) return null;
  const unread = rows.filter((n) => !n.readAt);
  return (
    <div className="mt-3 rounded-xl border border-brand/15 bg-blue-50/40 p-3" data-testid="section-notices" aria-label="Notifications for this section">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Updates{unread.length ? ` · ${unread.length} new` : ""}</p>
        {unread.length > 0 && <form action={markNoticesRead}>{unread.map((n) => <input key={n.id} type="hidden" name="id" value={n.id} />)}<input type="hidden" name="path" value={path} /><button className="text-xs font-semibold text-brand underline">Mark as read</button></form>}
      </div>
      <ul className="mt-1 divide-y divide-brand/10">
        {rows.map((n) => (
          <li key={n.id} className="flex gap-2 py-1.5 text-sm" data-testid="section-notice" data-unread={!n.readAt || undefined}>
            <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-gold"}`} />
            <div className="min-w-0 flex-1">
              <p><span className={n.readAt ? "" : "font-semibold"}>{n.title}</span>{!n.readAt && <span className="sr-only"> (unread)</span>} <span className="muted">· {n.body}</span></p>
              <p className="text-xs muted">{dateTime(n.createdAt)}{n.link && !n.link.startsWith(path.split("#")[0] + "#") && n.link !== path ? <> · <Link className="text-brand underline" href={n.link}>Open</Link></> : null}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
