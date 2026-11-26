import "server-only";
// Generic reads for the Content Manager screens. The entity definitions decide which table and columns are used;
// callers check permissions first.
import { and, asc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { ENTITIES, type Entity, type EntityKey } from "./entities";

export type Row = Record<string, unknown> & { id: string };
type Cols = Record<string, PgColumn>;
export const cols = (e: Entity) => e.table as unknown as Cols;
const table = (e: Entity) => e.table as unknown as PgTable;

export async function listRows(e: Entity, f: { status?: string; q?: string }) {
  const c = cols(e), w: SQL[] = [];
  if (e.hasStatus && f.status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(f.status)) w.push(eq(c.status, f.status));
  if (e.hasStatus && !f.status) w.push(inArray(c.status, ["DRAFT", "PUBLISHED"]));
  if (f.q) w.push(ilike(c[e.titleField], `%${f.q.replace(/[%_\\]/g, (x) => `\\${x}`)}%`));
  return (await db.select().from(table(e)).where(w.length ? and(...w) : undefined).orderBy(asc(c[e.orderBy]), asc(c[e.titleField])).limit(500)) as Row[];
}

export async function getRow(e: Entity, id: string) {
  const rows = (await db.select().from(table(e)).where(eq(cols(e).id, id)).limit(1)) as Row[];
  return rows[0] ?? null;
}

/** id → title for the records a "ref" field can point at. */
export async function refOptions(key: string) {
  const e = ENTITIES[key as EntityKey];
  const c = cols(e);
  const rows = (await db.select({ id: c.id, title: c[e.titleField] }).from(table(e)).orderBy(asc(c[e.titleField]))) as { id: string; title: string }[];
  return rows.map((r) => ({ value: r.id, label: r.title }));
}

/** Returns the label of the first ref field whose chosen id doesn't exist. */
export async function badRef(e: Entity, values: Record<string, unknown>) {
  for (const f of e.fields) {
    if (f.type !== "ref" || values[f.name] == null) continue;
    const r = ENTITIES[f.ref as EntityKey];
    const found = await db.select({ id: cols(r).id }).from(table(r)).where(eq(cols(r).id, String(values[f.name]))).limit(1);
    if (!found.length) return f.label;
  }
  return null;
}

export async function takenSlugs(e: Entity, base: string) {
  const c = cols(e);
  const rows = (await db.select({ slug: c.slug }).from(table(e)).where(sql`${c.slug} = ${base} or ${c.slug} like ${`${base}-%`}`)) as { slug: string }[];
  return rows.map((r) => r.slug);
}

export async function statusCounts(e: Entity) {
  const c = cols(e);
  if (!e.hasStatus) {
    const [{ n }] = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(table(e))) as { n: number }[];
    return { total: n } as Record<string, number>;
  }
  const rows = (await db.select({ status: c.status, n: sql<number>`count(*)`.mapWith(Number) }).from(table(e)).groupBy(c.status)) as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

export { table as tableOf };
