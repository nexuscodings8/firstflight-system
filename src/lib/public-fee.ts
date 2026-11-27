import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { matchingRules, type Scope } from "./fees";

/**
 * The total service fee a public visitor may see for a listing: the most specific active fee rule, total only.
 * Instalments, due dates and rule names are deliberately not selected, so they can't leak to the page.
 */
export async function publicFee(scope: Scope): Promise<{ amount: string; currency: string } | null> {
  const rules = await db.select({ id: s.feeRules.id, active: s.feeRules.active, service: s.feeRules.service, countryId: s.feeRules.countryId, jobId: s.feeRules.jobId,
    universityId: s.feeRules.universityId, programId: s.feeRules.programId, visaCategoryId: s.feeRules.visaCategoryId, amount: s.feeRules.amount, currency: s.feeRules.currency })
    .from(s.feeRules).where(eq(s.feeRules.active, true));
  const best = matchingRules(rules, scope)[0];
  return best ? { amount: best.amount, currency: best.currency } : null;
}

export async function countryIdByIso(iso: string) {
  return (await db.query.countries.findFirst({ where: eq(s.countries.isoCode, iso), columns: { id: true } }))?.id ?? null;
}
