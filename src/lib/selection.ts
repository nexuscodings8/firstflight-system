import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { countryName } from "./locations";
import { canApply } from "@/components/badges";

export type Selection = {
  service: "WORK" | "STUDY" | "VISA";
  title: string;
  details: [string, string][];
  jobId?: string; programId?: string; visaGuidanceId?: string;
  checklist: { label: string; mandatory: boolean }[];
  open: boolean;
  visa?: { nat: string; res: string; dest: string; city: string; purpose: string };
};

const ISO = /^[A-Z]{2}$/;
type Q = Record<string, string | undefined>;

/** Resolves what the client chose from the query string, re-reading published data on the server. */
export async function resolveSelection(q: Q): Promise<Selection | null> {
  if (q.job) {
    const j = await db.query.jobs.findFirst({ where: and(eq(s.jobs.id, q.job), eq(s.jobs.status, "PUBLISHED")), with: { country: true, category: true, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } } });
    if (!j) return null;
    return { service: "WORK", title: j.title, jobId: j.id, open: canApply(j.availability),
      details: [["Destination", j.country.name], ["Location", j.location], ["Category", j.category.name]],
      checklist: j.requirements.map((r) => ({ label: r.label, mandatory: r.mandatory })) };
  }
  if (q.program) {
    const p = await db.query.programs.findFirst({ where: and(eq(s.programs.id, q.program), eq(s.programs.status, "PUBLISHED")), with: { university: { with: { country: true } }, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } } });
    if (!p) return null;
    const intake = q.intake && p.intakes.includes(q.intake) ? q.intake : p.intakes[0] ?? "";
    return { service: "STUDY", title: p.name, programId: p.id, open: canApply(p.availability),
      details: [["University", p.university.name], ["Country", p.university.country.name], ["Intake", intake]],
      checklist: p.requirements.map((r) => ({ label: r.label, mandatory: r.mandatory })) };
  }
  if (q.visa) {
    const v = { nat: (q.nat ?? "").toUpperCase(), res: (q.res ?? "").toUpperCase(), dest: (q.dest ?? "").toUpperCase(), city: (q.city ?? "").slice(0, 80), purpose: q.purpose ?? "" };
    if (![v.nat, v.res, v.dest].every((x) => ISO.test(x))) return null;
    const g = await db.query.visaGuidance.findFirst({ where: and(eq(s.visaGuidance.id, q.visa), eq(s.visaGuidance.status, "PUBLISHED")), with: { category: true, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } } });
    if (!g || g.destinationIso !== v.dest) return null;
    return { service: "VISA", title: g.title, visaGuidanceId: g.id, open: g.reviewState === "CURRENT", visa: v,
      details: [["Passport", countryName(v.nat)], ["Residence", countryName(v.res)], ["Destination", `${v.city ? v.city + ", " : ""}${countryName(v.dest)}`], ["Purpose", g.category.name]],
      checklist: g.requirements.map((r) => ({ label: r.label, mandatory: r.mandatory })) };
  }
  return null;
}

/** Keys passed through the apply form (only these are trusted, and they are re-resolved on submit). */
export const SELECTION_KEYS = ["job", "program", "intake", "visa", "nat", "res", "dest", "city", "purpose"] as const;
