// Creates the database named in DATABASE_URL if it doesn't exist yet (used on the first Render deploy,
// where FIRST FLIGHT gets its own database on a shared Postgres server). Safe to run on every deploy.
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it in the service's Environment settings.");
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(dbName)) throw new Error(`Unexpected database name "${dbName}"`);

  // Already reachable? Nothing to do.
  const direct = new Client({ connectionString: url });
  try { await direct.connect(); await direct.end(); console.log(`Database "${dbName}" is ready.`); return; }
  catch (e) { if ((e as { code?: string }).code !== "3D000") throw e; } // 3D000 = database does not exist

  // Connect to the maintenance database on the same server and create ours.
  const admin = new URL(url); admin.pathname = "/postgres";
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`create database "${dbName}"`);
  await c.end();
  console.log(`Created database "${dbName}".`);
}

main().catch((e) => { console.error(`ensure-database failed: ${e.message}`); process.exit(1); });
