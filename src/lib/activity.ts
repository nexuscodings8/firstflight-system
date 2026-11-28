import "server-only";
import { applicationOf, sectionOf, type Section } from "./notice-sections";
import { db, schema } from "@/db";
import type { Role } from "./permissions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

/** Timestamped record of who did what. Pass the transaction so the log commits with the change. */
export async function logActivity(x: Exec, a: {
  actorId?: string | null; action: string; entityType: string; entityId: string;
  applicationId?: string | null; summary: string; changes?: unknown;
}) {
  await x.insert(schema.activities).values({ ...a, changes: a.changes ?? null });
}

/** Notify one person (userId) or a whole department (role). */
export async function notify(x: Exec, n: { userId?: string; role?: Role; title: string; body: string; link?: string; section?: Section; applicationId?: string | null }) {
  // Each notification is filed under the section it belongs to (and its application), to be shown in context.
  await x.insert(schema.notifications).values({ userId: n.userId ?? null, role: n.role ?? null, title: n.title, body: n.body, link: n.link ?? null,
    section: n.section ?? sectionOf(n.link, n.title), applicationId: n.applicationId ?? applicationOf(n.link) });
}
