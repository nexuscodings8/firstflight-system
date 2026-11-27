import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { markRead, openConversation, participants, titleOf } from "@/lib/messaging";
import { dateTime, label } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { sendMessage, toggleFollow } from "../actions";

export const metadata = { title: "Conversation" };

export default async function Conversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reply?: string }> }) {
  const { id } = await params;
  const replyTo = (await searchParams).reply;
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], `/staff/messages/${id}`);
  const c = await openConversation(user, id);
  if (!c) notFound();
  const [msgs, people, members] = await Promise.all([
    db.query.messages.findMany({ where: eq(s.messages.conversationId, c.id), orderBy: [asc(s.messages.createdAt)], limit: 500, with: { author: { columns: { id: true, name: true, role: true } } } }),
    participants(c),
    db.query.conversationMembers.findMany({ where: eq(s.conversationMembers.conversationId, c.id), with: { user: { columns: { name: true } } } }),
  ]);
  await markRead(c.id, user.id);
  const me = members.find((m) => m.userId === user.id);
  const following = c.kind !== "APPLICATION" ? true : !!me?.following;
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const reply = replyTo ? byId.get(replyTo) : undefined;
  const others = people.filter((p) => p.id !== user.id);
  const names = new Map(people.map((p) => [p.id, p.name]));
  return (
    <div className="grid gap-4">
      <AutoRefresh />
      <Link href="/staff/messages" className="text-sm font-semibold text-brand underline">← All messages</Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl">{titleOf({ ...c, members: members.map((m) => ({ userId: m.userId, user: m.user })) }, user.id)}{c.financePrivate && <span className="badge ml-2 bg-gold/20 text-ink align-middle">Finance only</span>}</h1>
          <p className="text-sm muted">Can read this: {people.map((p) => `${p.name} (${label(p.role)})`).join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.application && <Link className="btn-ghost btn-sm" href={`/staff/applications/${c.application.id}`}>Open {c.application.reference}</Link>}
          {c.kind === "APPLICATION" && <form action={toggleFollow}><input type="hidden" name="conversationId" value={c.id} /><input type="hidden" name="follow" value={following ? "0" : "1"} /><button className="btn-ghost btn-sm">{following ? "Following: stop" : "Follow this discussion"}</button></form>}
        </div>
      </div>
      <section className="card p-4" aria-label="Messages" aria-live="polite">
        <ol className="space-y-3">
          {msgs.map((m) => {
            const mine = m.authorId === user.id;
            const mentioned = ((m.mentions as string[] | null) ?? []).includes(user.id);
            return (
              <li key={m.id} id={`m-${m.id}`} className={`flex ${mine ? "justify-end" : ""}`} data-testid="message">
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${mine ? "bg-brand text-white" : mentioned ? "border-2 border-gold bg-gold/10" : "bg-mist"}`}>
                  <p className={`text-xs ${mine ? "text-white/80" : "muted"}`}>{m.author.name} · {dateTime(m.createdAt)}{(m.mentions as string[] | null)?.length ? ` · mentioned ${(m.mentions as string[]).map((x) => names.get(x) ?? "someone").join(", ")}` : ""}</p>
                  {m.parentId && byId.get(m.parentId) && <p className={`mb-1 border-l-2 pl-2 text-xs ${mine ? "border-white/60 text-white/80" : "border-brand/40 muted"}`}>Replying to {byId.get(m.parentId)!.author.name}: {byId.get(m.parentId)!.body.slice(0, 90)}</p>}
                  <p className="whitespace-pre-line">{m.body}</p>
                  {!mine && <Link href={`/staff/messages/${c.id}?reply=${m.id}#msg-body`} className="mt-1 inline-block text-xs font-semibold text-brand underline">Reply</Link>}
                </div>
              </li>
            );
          })}
        </ol>
        {!msgs.length && <p className="text-sm muted">No messages yet. Start the conversation below.</p>}
      </section>
      <ActionForm action={sendMessage} submit="Send" pendingLabel="Sending…" className="card grid gap-2 p-4">
        <input type="hidden" name="conversationId" value={c.id} />
        {reply && <><input type="hidden" name="parentId" value={reply.id} /><p className="rounded-lg bg-mist px-3 py-2 text-sm">Replying to <strong>{reply.author.name}</strong>: {reply.body.slice(0, 120)} <Link className="ml-2 text-brand underline" href={`/staff/messages/${c.id}`}>Cancel</Link></p></>}
        <label className="sr-only" htmlFor="msg-body">Message</label>
        <textarea id="msg-body" name="body" rows={3} className="input" placeholder="Write a message or post an update on this client. Type @ and a name to mention someone." required maxLength={4000} />
        {others.length > 0 && <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm"><legend className="mb-1 text-xs font-semibold muted">Colleagues concerned (notified)</legend>{others.map((p) => <label key={p.id} className="flex items-center gap-1.5"><input type="checkbox" name="concerned" value={p.id} /> {p.name}</label>)}</fieldset>}
      </ActionForm>
    </div>
  );
}
