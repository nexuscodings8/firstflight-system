import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { markRead, openConversation, participants, titleOf } from "@/lib/messaging";
import { dateTime, label } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { sendMessage } from "../actions";

export const metadata = { title: "Conversation" };

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], `/staff/messages/${id}`);
  const c = await openConversation(user, id);
  if (!c) notFound();
  const [msgs, people, members] = await Promise.all([
    db.query.messages.findMany({ where: eq(s.messages.conversationId, c.id), orderBy: [asc(s.messages.createdAt)], limit: 500, with: { author: { columns: { id: true, name: true, role: true } } } }),
    participants(c),
    db.query.conversationMembers.findMany({ where: eq(s.conversationMembers.conversationId, c.id), with: { user: { columns: { name: true } } } }),
  ]);
  await markRead(c.id, user.id);
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
        {c.application && <Link className="btn-ghost btn-sm" href={`/staff/applications/${c.application.id}`}>Open {c.application.reference}</Link>}
      </div>
      <section className="card p-4" aria-label="Messages" aria-live="polite">
        <ol className="space-y-3">
          {msgs.map((m) => {
            const mine = m.authorId === user.id;
            const mentioned = ((m.mentions as string[] | null) ?? []).includes(user.id);
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : ""}`} data-testid="message">
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${mine ? "bg-brand text-white" : mentioned ? "border-2 border-gold bg-gold/10" : "bg-mist"}`}>
                  <p className={`text-xs ${mine ? "text-white/80" : "muted"}`}>{m.author.name} · {dateTime(m.createdAt)}{(m.mentions as string[] | null)?.length ? ` · mentioned ${(m.mentions as string[]).map((x) => names.get(x) ?? "someone").join(", ")}` : ""}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {!msgs.length && <p className="text-sm muted">No messages yet. Start the conversation below.</p>}
      </section>
      <ActionForm action={sendMessage} submit="Send" pendingLabel="Sending…" className="card grid gap-2 p-4">
        <input type="hidden" name="conversationId" value={c.id} />
        <label className="sr-only" htmlFor="msg-body">Message</label>
        <textarea id="msg-body" name="body" rows={3} className="input" placeholder="Write a message. Type @ and a name to mention someone." required maxLength={4000} />
      </ActionForm>
    </div>
  );
}
