"use server";
// Staff messaging. Access is checked on the server for every read and write (see lib/message-rules).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/activity";
import { badMembers, findMentions } from "@/lib/message-rules";
import { openConversation, participants } from "@/lib/messaging";
import { canViewApplication } from "@/lib/permissions";

type St = { ok?: string; error?: string } | undefined;
const STAFF = ["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"] as const;
const str = (fd: FormData, k: string, n = 4000) => String(fd.get(k) ?? "").trim().slice(0, n);

export async function sendMessage(_: St, fd: FormData): Promise<St> {
  const user = await requireUser([...STAFF]);
  const c = await openConversation(user, str(fd, "conversationId", 64));
  if (!c) return { error: "You can't post in this conversation." };
  const body = str(fd, "body", 4000);
  if (!body) return { error: "Write a message first." };
  const people = (await participants(c)).filter((p) => p.id !== user.id);
  const mentions = findMentions(body, people);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(s.messages).values({ conversationId: c.id, authorId: user.id, body, mentions: mentions.length ? mentions : null, createdAt: now });
    await tx.update(s.conversations).set({ lastMessageAt: now }).where(eq(s.conversations.id, c.id));
    await tx.insert(s.conversationMembers).values({ conversationId: c.id, userId: user.id, lastReadAt: now }).onConflictDoUpdate({ target: [s.conversationMembers.conversationId, s.conversationMembers.userId], set: { lastReadAt: now } });
    const where = c.kind === "APPLICATION" ? `${c.application?.reference}${c.financePrivate ? " (Finance only)" : ""}` : c.kind === "DIRECT" ? "a direct message" : (c.title ?? "a group");
    for (const id of mentions) await notify(tx, { userId: id, title: `${user.name} mentioned you`, body: `In ${where}: ${body.slice(0, 120)}`, link: `/staff/messages/${c.id}` });
    if (c.kind === "DIRECT") for (const p of people.filter((x) => !mentions.includes(x.id))) await notify(tx, { userId: p.id, title: `Message from ${user.name}`, body: body.slice(0, 140), link: `/staff/messages/${c.id}` });
  });
  revalidatePath(`/staff/messages/${c.id}`); revalidatePath("/staff/messages");
  return { ok: mentions.length ? `Sent. ${mentions.length} ${mentions.length === 1 ? "person was" : "people were"} notified.` : "Sent." };
}

/** Opens (or reuses) a direct conversation with one staff member. */
export async function startDirect(fd: FormData) {
  const user = await requireUser([...STAFF]);
  const other = await db.query.users.findFirst({ where: and(eq(s.users.id, str(fd, "userId", 64)), eq(s.users.active, true)), columns: { id: true, role: true } });
  if (!other || other.id === user.id || badMembers([other.role], false)) redirect("/staff/messages?error=person");
  const mine = await db.select({ id: s.conversationMembers.conversationId }).from(s.conversationMembers).innerJoin(s.conversations, eq(s.conversations.id, s.conversationMembers.conversationId)).where(and(eq(s.conversationMembers.userId, user.id), eq(s.conversations.kind, "DIRECT")));
  const shared = mine.length ? await db.select({ id: s.conversationMembers.conversationId }).from(s.conversationMembers).where(and(eq(s.conversationMembers.userId, other.id), inArray(s.conversationMembers.conversationId, mine.map((m) => m.id)))) : [];
  let id = shared[0]?.id;
  if (!id) {
    id = await db.transaction(async (tx) => {
      const [c] = await tx.insert(s.conversations).values({ kind: "DIRECT", createdById: user.id }).returning({ id: s.conversations.id });
      await tx.insert(s.conversationMembers).values([{ conversationId: c.id, userId: user.id }, { conversationId: c.id, userId: other.id }]);
      return c.id;
    });
  }
  redirect(`/staff/messages/${id}`);
}

export async function createGroup(_: St, fd: FormData): Promise<St> {
  const user = await requireUser([...STAFF]);
  const title = str(fd, "title", 80);
  const financePrivate = fd.get("financePrivate") === "on";
  const ids = [...new Set(fd.getAll("members").map(String).filter((x) => x && x !== user.id))].slice(0, 50);
  if (title.length < 3) return { error: "Name the group." };
  if (!ids.length) return { error: "Choose at least one other person." };
  if (financePrivate && user.role !== "FINANCE" && user.role !== "ADMIN") return { error: "Only Finance and administrators can create a Finance-only group." };
  const people = await db.select({ id: s.users.id, role: s.users.role }).from(s.users).where(and(inArray(s.users.id, ids), eq(s.users.active, true)));
  if (people.length !== ids.length) return { error: "Someone you chose isn't an active staff member." };
  const bad = badMembers(people.map((p) => p.role), financePrivate);
  if (bad) return { error: bad };
  const id = await db.transaction(async (tx) => {
    const [c] = await tx.insert(s.conversations).values({ kind: "GROUP", title, financePrivate, createdById: user.id }).returning({ id: s.conversations.id });
    await tx.insert(s.conversationMembers).values([user.id, ...ids].map((u) => ({ conversationId: c.id, userId: u })));
    for (const u of ids) await notify(tx, { userId: u, title: `Added to "${title}"`, body: `${user.name} added you to a ${financePrivate ? "Finance-only " : ""}group.`, link: `/staff/messages/${c.id}` });
    return c.id;
  });
  redirect(`/staff/messages/${id}`);
}

/** Opens an application's team thread or Finance-only thread, creating it the first time. */
export async function openAppThread(fd: FormData) {
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)), columns: { id: true, clientId: true, consultantId: true, service: true } });
  const priv = fd.get("private") === "1";
  if (!app || !canViewApplication(user, app) || (priv && user.role === "CONSULTANT")) redirect("/staff/messages?error=thread");
  const { appThread } = await import("@/lib/messaging");
  redirect(`/staff/messages/${await appThread(app.id, priv, user.id)}`);
}
