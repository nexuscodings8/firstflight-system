import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Scope } from "./fees";

/** The country, listing and visa purpose an application is about, for matching fee rules. */
export async function scopeOf(app: { service: string; jobId: string | null; programId: string | null; visaGuidanceId: string | null }): Promise<Scope> {
  if (app.jobId) {
    const j = await db.query.jobs.findFirst({ where: eq(s.jobs.id, app.jobId), columns: { countryId: true } });
    return { service: app.service, jobId: app.jobId, countryId: j?.countryId };
  }
  if (app.programId) {
    const p = await db.query.programs.findFirst({ where: eq(s.programs.id, app.programId), columns: { universityId: true }, with: { university: { columns: { countryId: true } } } });
    return { service: app.service, programId: app.programId, universityId: p?.universityId, countryId: p?.university.countryId };
  }
  if (app.visaGuidanceId) {
    const g = await db.query.visaGuidance.findFirst({ where: eq(s.visaGuidance.id, app.visaGuidanceId), columns: { categoryId: true, destinationIso: true } });
    const c = g ? await db.query.countries.findFirst({ where: eq(s.countries.isoCode, g.destinationIso), columns: { id: true } }) : null;
    return { service: app.service, visaCategoryId: g?.categoryId, countryId: c?.id };
  }
  return { service: app.service };
}

