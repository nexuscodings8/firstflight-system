import { SectionNotices } from "@/components/section-notices";
import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listConversations } from "@/lib/messaging";
import { dateTime, label } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { Empty } from "@/components/cards";
import { createGroup, startDirect } from "./actions";

export const metadata = { title: "Messages" };

export default async function Messages({ searchParams }: { searchParams: Promise<{ error?: string; q?: string }> }) {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff/messages");
  const sp = await searchParams;
  const err = sp.error;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const [convs, staff] = await Promise.all([
    listConversations(user),
    db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users).where(and(eq(s.users.active, true), ne(s.users.id, user.id), inArray(s.users.role, ["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"]))).orderBy(asc(s.users.name)),
  ]);
  const financeSide = user.role === "FINANCE" || user.role === "ADMIN";
  // Search only inside conversations this user may read (the same check as opening them).
  const titles = new Map(convs.map((c) => [c.id, c.title]));
  const hits = q.length >= 2 && convs.length ? await db.query.messages.findMany({
    where: and(inArray(s.messages.conversationId, convs.map((c) => c.id)), ilike(s.messages.body, `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`)),
    orderBy: [desc(s.messages.createdAt)], limit: 50, with: { author: { columns: { name: true } } },
  }) : [];
  return (
    <div className="grid gap-5">
      <AutoRefresh seconds={15} />
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Messages</h1><p className="mt-1 max-w-2xl text-sm muted">Internal staff conversations. Clients never see these. Mention someone with @ and their name to notify them.</p></div>
      <SectionNotices user={user} sections={["messages"]} path="/staff/messages" limit={5} />
      <form action="/staff/messages" role="search" className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="msg-q">Search conversations</label>
        <input id="msg-q" name="q" defaultValue={q} className="input max-w-md flex-1" placeholder="Search previous conversations" />
        <button className="btn-primary btn-sm">Search</button>{q && <Link className="btn-ghost btn-sm" href="/staff/messages">Clear</Link>}
      </form>
      {q && (
        <section className="card p-4" aria-label="Search results">
          <h2 className="text-base">{hits.length ? `${hits.length} message${hits.length === 1 ? "" : "s"} matching “${q}”` : `No messages match “${q}”`}</h2>
          <ul className="mt-2 divide-y divide-line">{hits.map((m) => <li key={m.id} data-testid="search-hit"><Link href={`/staff/messages/${m.conversationId}#m-${m.id}`} className="block py-2 hover:bg-mist/60"><p className="text-xs muted">{titles.get(m.conversationId)} · {m.author.name} · {dateTime(m.createdAt)}</p><p className="text-sm">{m.body.slice(0, 200)}</p></Link></li>)}</ul>
        </section>
      )}
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err === "thread" ? "You can't open that thread." : "You can't message that person."}</p>}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-0" aria-label="Conversations">
          <ul className="divide-y divide-line">
            {convs.map((c) => (
              <li key={c.id}><Link href={`/staff/messages/${c.id}`} className="flex items-start justify-between gap-3 p-4 hover:bg-mist/60" data-testid="conversation">
                <div className="min-w-0">
                  <p className="font-semibold">{c.title}{c.financePrivate && <span className="badge ml-2 bg-gold/20 text-ink">Finance only</span>}{c.kind === "GROUP" && <span className="ml-2 text-xs muted">{c.members.length} people</span>}</p>
                  <p className="truncate text-sm muted">{c.messages[0] ? `${c.messages[0].author.name}: ${c.messages[0].body}` : "No messages yet"}</p>
                </div>
                <div className="shrink-0 text-right"><p className="text-xs muted">{dateTime(c.lastMessageAt)}</p>{c.unread > 0 && <span className="badge mt-1 bg-brand text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}</div>
              </Link></li>
            ))}
          </ul>
          {!convs.length && <div className="p-4"><Empty title="No conversations yet" /></div>}
        </section>
        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-lg">Direct message</h2>
            <form action={startDirect} className="mt-3 grid gap-2">
              <label className="sr-only" htmlFor="dm-user">Person</label>
              <select id="dm-user" name="userId" className="input" required defaultValue=""><option value="" disabled>Choose a colleague</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.name} ({label(p.role)})</option>)}</select>
              <button className="btn-primary btn-sm justify-self-start">Open conversation</button>
            </form>
          </section>
          <section className="card p-5">
            <h2 className="text-lg">New group</h2>
            <ActionForm action={createGroup} submit="Create group" className="mt-3 grid gap-2">
              <label className="label" htmlFor="g-title">Group name</label><input id="g-title" name="title" className="input" required maxLength={80} />
              <fieldset className="max-h-48 overflow-y-auto rounded-xl border border-line p-2"><legend className="label px-1">Members</legend>
                {staff.map((p) => <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" name="members" value={p.id} /> {p.name} <span className="muted">({label(p.role)})</span></label>)}
              </fieldset>
              {financeSide && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="financePrivate" className="mt-1" /> Finance only (only Finance and administrators can be members)</label>}
            </ActionForm>
          </section>
        </aside>
      </div>
    </div>
  );
}
