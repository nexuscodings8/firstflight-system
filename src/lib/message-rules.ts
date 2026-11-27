// Who may read and write a staff conversation. Pure and unit-tested; checked on every request.
import type { Role } from "./permissions";

export type ConvLike = { kind: string; financePrivate: boolean; applicationId: string | null };
export type AppLike = { consultantId: string | null; service: string } | null;
export type Who = { id: string; role: Role; services?: string[] };

export const FINANCE_SIDE: Role[] = ["FINANCE", "ADMIN"];

export function canUseConversation(u: Who, c: ConvLike, isMember: boolean, app: AppLike): boolean {
  if (u.role === "CLIENT") return false;
  if (c.financePrivate && !FINANCE_SIDE.includes(u.role)) return false;
  if (c.kind === "APPLICATION") {
    if (!app) return false;
    if (u.role === "ADMIN" || u.role === "FINANCE") return true;
    if (u.role === "CONSULTANT") return !c.financePrivate && app.consultantId === u.id && (!u.services || u.services.includes(app.service));
    return false;
  }
  return isMember;
}

/** Members of a new group or direct message must be staff; a Finance-private group only Finance and Admin. */
export function badMembers(roles: Role[], financePrivate: boolean): string | null {
  if (roles.some((r) => r === "CLIENT")) return "Clients can't be added to staff conversations.";
  if (financePrivate && roles.some((r) => !FINANCE_SIDE.includes(r))) return "A Finance-only conversation can include only Finance and administrators.";
  return null;
}

/** People named as @Full Name or @FirstName in a message, from those allowed in the conversation. */
export function findMentions(body: string, people: { id: string; name: string }[]): string[] {
  const text = body.toLowerCase();
  const firstCounts = new Map<string, number>();
  for (const p of people) { const f = p.name.split(/\s+/)[0].toLowerCase(); firstCounts.set(f, (firstCounts.get(f) ?? 0) + 1); }
  return people.filter((p) => {
    const full = p.name.toLowerCase(), first = full.split(/\s+/)[0];
    if (text.includes(`@${full}`)) return true;
    // A first name only counts when it's unique among the people here and isn't followed by more letters.
    return firstCounts.get(first) === 1 && new RegExp(`(^|\\s)@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(text);
  }).map((p) => p.id);
}
