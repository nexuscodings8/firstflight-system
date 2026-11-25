// Pure matching logic for the visa checker (unit-tested).
export type GuidanceCandidate = {
  id: string; destinationCity: string | null; nationalityIso: string | null; residenceIso: string | null;
  reviewState: "CURRENT" | "NEEDS_REVIEW"; lastCheckedAt: Date;
};
export type VisaQuery = { nationality: string; residence: string; city?: string | null };

export const STALE_AFTER_DAYS = 180;

/** The country-wide entry is the base checklist: most specific wins, nationality (2) > residence (1).
 *  A city entry only adds local guidance and extra documents for that city; it never replaces the base.
 *  Entries for other passports, residences or cities are excluded. */
export function pickGuidance<T extends GuidanceCandidate>(cands: T[], q: VisaQuery, now = new Date()) {
  const city = (q.city ?? "").trim().toLowerCase();
  const fit = cands.filter((c) =>
    (!c.nationalityIso || c.nationalityIso === q.nationality) &&
    (!c.residenceIso || c.residenceIso === q.residence) &&
    (!c.destinationCity || c.destinationCity.toLowerCase() === city));
  const score = (c: T) => (c.nationalityIso ? 2 : 0) + (c.residenceIso ? 1 : 0);
  const top = (l: T[]) => l.sort((a, b) => score(b) - score(a))[0] ?? null;
  const best = top(fit.filter((c) => !c.destinationCity));
  const cityExtra = top(fit.filter((c) => c.destinationCity));
  if (!best) return { guidance: null, cityExtra: null, needsConsultation: true, reason: "none" as const };
  const stale = now.getTime() - best.lastCheckedAt.getTime() > STALE_AFTER_DAYS * 86_400_000;
  if (best.reviewState === "NEEDS_REVIEW") return { guidance: best, cityExtra, needsConsultation: true, reason: "review" as const };
  if (stale) return { guidance: best, cityExtra, needsConsultation: true, reason: "stale" as const };
  return { guidance: best, cityExtra, needsConsultation: false, reason: null };
}
