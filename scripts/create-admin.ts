// Usage: npx tsx --env-file=.env scripts/create-admin.ts "Full Name" email password
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "../src/db/schema";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 12) {
  console.error('Usage: create-admin "Full Name" email password   (password: 12+ characters)');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
drizzle(pool, { schema: s }).insert(s.users)
  .values({ name, email: email.toLowerCase(), role: "ADMIN", passwordHash: bcrypt.hashSync(password, 12) })
  .then(() => console.log(`Administrator ${email} created.`))
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
