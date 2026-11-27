import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** A single-use activation link token, valid for 7 days. Only its hash is stored. */
export async function createActivationToken(userId: string, createdById: string) {
  const token = randomBytes(32).toString("base64url");
  await db.update(s.accountTokens).set({ usedAt: new Date() }).where(and(eq(s.accountTokens.userId, userId), isNull(s.accountTokens.usedAt)));
  await db.insert(s.accountTokens).values({ userId, tokenHash: hash(token), purpose: "ACTIVATE", expiresAt: new Date(Date.now() + 7 * 86_400_000), createdById });
  return token;
}

export async function findActivation(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const row = await db.query.accountTokens.findFirst({ where: and(eq(s.accountTokens.tokenHash, hash(token)), isNull(s.accountTokens.usedAt), gt(s.accountTokens.expiresAt, new Date())) });
  return row ?? null;
}
