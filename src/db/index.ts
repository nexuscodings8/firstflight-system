import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per server process (reused across hot reloads in development).
const g = globalThis as unknown as { ffPool?: Pool };
const pool = g.ffPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.ffPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };
