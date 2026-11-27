import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { CurrentUser } from "./auth";
import { canUseConversation, FINANCE_SIDE } from "./message-rules";

/** A conversation with its application (if any) when this user may use it, else null. */
export async function openConversation(user: CurrentUser, id: string) {
  const c = await db.query.conversations.findFirst({ where: eq(s.conversations.id, id), with: { application: { columns: { id: true, reference: true, consultantId: true, service: true } } } });
  if (!c) return null;
  const [m] = await db.select({ u: s.conversationMembers.userId }).from(s.conversationMembers).where(and(eq(s.conversationMembers.conversationId, id), eq(s.conversationMembers.userId, user.id)));
  return canUseConversation(user, c, !!m, c.application ?? null) ? c : null;
}
export type Conv = NonNullable<Awaited<ReturnType<typeof openConversation>>>;

/** Everyone who may read the conversation: members, or for an application thread the staff with access to it. */
export async function participants(c: Conv) {
  if (c.kind !== "APPLICATION") {
    return db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.conversationMembers).innerJoin(s.users, eq(s.users.id, s.conversationMembers.userId)).where(and(eq(s.conversationMembers.conversationId, c.id), eq(s.users.active, true)));
  }
  const roles = c.financePrivate ? FINANCE_SIDE : (["FINANCE", "ADMIN"] as const);
  const conds = [inArray(s.users.role, [...roles])];
  if (!c.financePrivate && c.application?.consultantId) conds.push(eq(s.users.id, c.application.consultantId));
  return db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users).where(and(eq(s.users.active, true), or(...conds)));
}

/** Finds or creates the team thread (or the Finance-only thread) of an application. */
export async function appThread(appId: string, financePrivate: boolean, by: string) {
  return db.transaction(async (tx) => {
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, appId)).for("update");
    const found = await tx.query.conversations.findFirst({ where: and(eq(s.conversations.kind, "APPLICATION"), eq(s.conversations.applicationId, appId), eq(s.conversations.financePrivate, financePrivate)) });
    if (found) return found.id;
    const [c] = await tx.insert(s.conversations).values({ kind: "APPLICATION", applicationId: appId, financePrivate, createdById: by }).returning({ id: s.conversations.id });
    return c.id;
  });
}

export async function markRead(convId: string, userId: string) {
  await db.insert(s.conversationMembers).values({ conversationId: convId, userId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [s.conversationMembers.conversationId, s.conversationMembers.userId], set: { lastReadAt: new Date() } });
}

/** Conversations to list for a user, newest first, with unread counts. */
export async function listConversations(user: CurrentUser) {
  const memberOf = db.select({ id: s.conversationMembers.conversationId }).from(s.conversationMembers).where(eq(s.conversationMembers.userId, user.id));
  const appScope = user.role === "ADMIN" || user.role === "FINANCE"
    ? and(eq(s.conversations.kind, "APPLICATION"), isNotNull(s.conversations.applicationId))
    : user.role === "CONSULTANT"
      ? and(eq(s.conversations.kind, "APPLICATION"), eq(s.conversations.financePrivate, false), inArray(s.conversations.applicationId, db.select({ id: s.applications.id }).from(s.applications).where(and(eq(s.applications.consultantId, user.id), inArray(s.applications.service, (user.services ?? []).filter((x) => x !== "FLIGHT") as ("WORK" | "STUDY" | "VISA")[])))))
      : sql`false`;
  const convs = await db.query.conversations.findMany({
    where: or(and(ne(s.conversations.kind, "APPLICATION"), inArray(s.conversations.id, memberOf)), and(appScope, sql`exists (select 1 from messages m where m.conversation_id = ${s.conversations.id})`)),
    orderBy: [desc(s.conversations.lastMessageAt)], limit: 100,
    with: { application: { columns: { id: true, reference: true, consultantId: true, service: true } }, members: { with: { user: { columns: { id: true, name: true } } } }, messages: { orderBy: [desc(s.messages.createdAt)], limit: 1, with: { author: { columns: { name: true } } } } },
  });
  const visible = convs.filter((c) => canUseConversation(user, c, c.members.some((m) => m.userId === user.id), c.application ?? null));
  const unread = new Map<string, number>();
  if (visible.length) {
    const rows = await db.select({ id: s.messages.conversationId, n: sql<number>`count(*)::int` }).from(s.messages)
      .leftJoin(s.conversationMembers, and(eq(s.conversationMembers.conversationId, s.messages.conversationId), eq(s.conversationMembers.userId, user.id)))
      .where(and(inArray(s.messages.conversationId, visible.map((c) => c.id)), ne(s.messages.authorId, user.id), or(sql`${s.conversationMembers.lastReadAt} is null`, gt(s.messages.createdAt, s.conversationMembers.lastReadAt))))
      .groupBy(s.messages.conversationId);
    for (const r of rows) unread.set(r.id, r.n);
  }
  return visible.map((c) => ({ ...c, unread: unread.get(c.id) ?? 0, title: titleOf(c, user.id) }));
}

export function titleOf(c: { kind: string; title: string | null; financePrivate: boolean; application?: { reference: string } | null; members?: { userId: string; user: { name: string } }[] }, me: string) {
  if (c.kind === "APPLICATION") return `${c.application?.reference ?? "Application"}: ${c.financePrivate ? "Finance only" : "team thread"}`;
  if (c.kind === "DIRECT") return c.members?.find((m) => m.userId !== me)?.user.name ?? "Direct message";
  return c.title ?? "Group";
}

export const unreadTotal = async (user: CurrentUser) => (await listConversations(user)).reduce((t, c) => t + c.unread, 0);
