// Loads the TEST sample data only when the database has no users yet and SEED_ON_EMPTY=true.
// It never runs against a database that already has data, so real records are never wiped.
import { Client } from "pg";
import { execFileSync } from "node:child_process";

async function main() {
  if (process.env.SEED_ON_EMPTY !== "true") { console.log("SEED_ON_EMPTY is not true: skipping sample data."); return; }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query("select count(*)::int as n from users");
  await c.end();
  if (rows[0].n > 0) { console.log(`Database already has ${rows[0].n} users: not seeding.`); return; }
  execFileSync("npx", ["tsx", "src/db/seed.ts"], { stdio: "inherit" });
}

main().catch((e) => { console.error(`seed-if-empty failed: ${e.message}`); process.exit(1); });
