import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { formatRef } from "./ref-format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Atomically increments a named counter and returns the formatted reference. */
export async function nextRef(x: typeof db | Tx, prefix: string, year = new Date().getFullYear()) {
  const key = `${prefix}-${year}`;
  const res = await x.execute<{ value: number }>(sql`
    insert into counters (key, value) values (${key}, 1)
    on conflict (key) do update set value = counters.value + 1
    returning value`);
  return formatRef(prefix, year, Number(res.rows[0].value));
}
