import "server-only";
import { and, asc, desc, eq, gt, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";

const PUB = "PUBLISHED" as const;

// ---------- work abroad ----------
export async function workCountries() {
  return db
    .select({ id: s.countries.id, name: s.countries.name, slug: s.countries.slug, iso: s.countries.isoCode, blurb: s.countries.blurb,
      openJobs: sql<number>`count(${s.jobs.id}) filter (where ${s.jobs.status} = 'PUBLISHED' and ${s.jobs.availability} in ('OPEN','CLOSING_SOON'))`.mapWith(Number) })
    .from(s.countries)
    .leftJoin(s.jobs, eq(s.jobs.countryId, s.countries.id))
    .where(and(eq(s.countries.workDestination, true), eq(s.countries.status, PUB)))
    .groupBy(s.countries.id)
    .orderBy(asc(s.countries.sortOrder));
}

export const jobCategories = () => db.select().from(s.jobCategories).orderBy(asc(s.jobCategories.name));

export type JobFilter = { country?: string; category?: string; availability?: string; q?: string };
export async function listJobs(f: JobFilter) {
  const w: SQL[] = [eq(s.jobs.status, PUB), eq(s.countries.status, PUB)];
  if (f.country) w.push(eq(s.countries.slug, f.country));
  if (f.category) w.push(eq(s.jobCategories.slug, f.category));
  if (f.availability === "open") w.push(inArray(s.jobs.availability, ["OPEN", "CLOSING_SOON"]));
  else if (f.availability) w.push(eq(s.jobs.availability, f.availability.toUpperCase() as "OPEN"));
  if (f.q) w.push(or(ilike(s.jobs.title, `%${f.q}%`), ilike(s.jobs.location, `%${f.q}%`))!);
  return db
    .select({ job: s.jobs, country: { name: s.countries.name, slug: s.countries.slug }, category: { name: s.jobCategories.name, slug: s.jobCategories.slug } })
    .from(s.jobs)
    .innerJoin(s.countries, eq(s.countries.id, s.jobs.countryId))
    .innerJoin(s.jobCategories, eq(s.jobCategories.id, s.jobs.categoryId))
    .where(and(...w))
    .orderBy(sql`case ${s.jobs.availability} when 'OPEN' then 0 when 'CLOSING_SOON' then 1 else 2 end`, asc(s.jobs.deadline));
}

// `preview` (content staff only, checked by the page) also returns drafts and archived records.
export async function getJob(countrySlug: string, jobSlug: string, preview = false) {
  const row = await db.query.jobs.findFirst({
    where: and(eq(s.jobs.slug, jobSlug), preview ? undefined : eq(s.jobs.status, PUB)),
    with: { country: true, category: true, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } },
  });
  if (!row || row.country.slug !== countrySlug || (!preview && row.country.status !== PUB)) return null;
  return row;
}
export const getCountryBySlug = (slug: string) =>
  db.query.countries.findFirst({ where: and(eq(s.countries.slug, slug), eq(s.countries.status, PUB)), with: { continent: true } });

// ---------- study abroad ----------
export async function studyContinents() {
  return db
    .select({ id: s.continents.id, name: s.continents.name, slug: s.continents.slug,
      countries: sql<number>`count(distinct ${s.countries.id}) filter (where ${s.countries.studyDestination} and ${s.countries.status} = 'PUBLISHED')`.mapWith(Number) })
    .from(s.continents)
    .leftJoin(s.countries, eq(s.countries.continentId, s.continents.id))
    .groupBy(s.continents.id)
    .orderBy(asc(s.continents.sortOrder));
}

export async function studyCountries(continentSlug: string) {
  return db
    .select({ id: s.countries.id, name: s.countries.name, slug: s.countries.slug, blurb: s.countries.blurb,
      universities: sql<number>`count(distinct ${s.universities.id})`.mapWith(Number) })
    .from(s.countries)
    .innerJoin(s.continents, eq(s.continents.id, s.countries.continentId))
    .leftJoin(s.universities, and(eq(s.universities.countryId, s.countries.id), eq(s.universities.status, PUB)))
    .where(and(eq(s.continents.slug, continentSlug), eq(s.countries.studyDestination, true), eq(s.countries.status, PUB)))
    .groupBy(s.countries.id)
    .orderBy(asc(s.countries.sortOrder));
}

export async function universitiesIn(countryId: string) {
  return db
    .select({ uni: s.universities, programs: sql<number>`count(${s.programs.id}) filter (where ${s.programs.status} = 'PUBLISHED')`.mapWith(Number) })
    .from(s.universities)
    .leftJoin(s.programs, eq(s.programs.universityId, s.universities.id))
    .where(and(eq(s.universities.countryId, countryId), eq(s.universities.status, PUB)))
    .groupBy(s.universities.id)
    .orderBy(asc(s.universities.name));
}

export const getUniversity = (slug: string, preview = false) =>
  db.query.universities.findFirst({
    where: and(eq(s.universities.slug, slug), preview ? undefined : eq(s.universities.status, PUB)),
    with: { country: { with: { continent: true } }, programs: { where: eq(s.programs.status, PUB), orderBy: [asc(s.programs.name)] } },
  });

export const getProgram = (slug: string, preview = false) =>
  db.query.programs.findFirst({
    where: and(eq(s.programs.slug, slug), preview ? undefined : eq(s.programs.status, PUB)),
    with: { university: { with: { country: { with: { continent: true } } } }, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } },
  });

export type ProgramFilter = { q?: string; country?: string; university?: string; level?: string; intake?: string };
export async function searchPrograms(f: ProgramFilter) {
  const w: SQL[] = [eq(s.programs.status, PUB), eq(s.universities.status, PUB), eq(s.countries.status, PUB)];
  if (f.q) w.push(or(ilike(s.programs.name, `%${f.q}%`), ilike(s.universities.name, `%${f.q}%`))!);
  if (f.country) w.push(eq(s.countries.slug, f.country));
  if (f.university) w.push(eq(s.universities.slug, f.university));
  if (f.level) w.push(eq(s.programs.level, f.level as "MASTER"));
  if (f.intake) w.push(sql`${f.intake} = any(${s.programs.intakes})`);
  return db
    .select({ program: s.programs, uni: { name: s.universities.name, slug: s.universities.slug, city: s.universities.city }, country: { name: s.countries.name, slug: s.countries.slug }, continent: { slug: s.continents.slug } })
    .from(s.programs)
    .innerJoin(s.universities, eq(s.universities.id, s.programs.universityId))
    .innerJoin(s.countries, eq(s.countries.id, s.universities.countryId))
    .innerJoin(s.continents, eq(s.continents.id, s.countries.continentId))
    .where(and(...w))
    .orderBy(asc(s.programs.name));
}

export async function studyFilterOptions() {
  const [countries, unis, intakes] = await Promise.all([
    db.select({ name: s.countries.name, slug: s.countries.slug }).from(s.countries).where(and(eq(s.countries.studyDestination, true), eq(s.countries.status, PUB))).orderBy(asc(s.countries.name)),
    db.select({ name: s.universities.name, slug: s.universities.slug }).from(s.universities).where(eq(s.universities.status, PUB)).orderBy(asc(s.universities.name)),
    db.execute<{ intake: string }>(sql`select distinct unnest(intakes) as intake from programs where status = 'PUBLISHED'`),
  ]);
  const order = (x: string) => { const [m, y] = x.split(" "); return Number(y) * 12 + new Date(`${m} 1, 2000`).getMonth(); };
  return { countries, unis, intakes: intakes.rows.map((r) => r.intake).sort((a, b) => order(a) - order(b)) };
}

// ---------- visa ----------
export const visaCategories = () => db.select().from(s.visaCategories).where(eq(s.visaCategories.active, true)).orderBy(asc(s.visaCategories.sortOrder));

export const visaCandidates = (destinationIso: string, categorySlug: string) =>
  db.query.visaGuidance.findMany({
    where: and(eq(s.visaGuidance.destinationIso, destinationIso), eq(s.visaGuidance.status, PUB),
      eq(s.visaGuidance.categoryId, sql`(select id from visa_categories where slug = ${categorySlug} and active)`)),
    with: { category: true, requirements: { orderBy: [asc(s.requirementItems.sortOrder)] } },
  });

// ---------- homepage content ----------
export async function homeContent() {
  const now = new Date();
  const [featuredJobs, featuredPrograms, promos, portfolio, testimonials, news] = await Promise.all([
    db.select({ job: s.jobs, country: { name: s.countries.name, slug: s.countries.slug } }).from(s.jobs)
      .innerJoin(s.countries, eq(s.countries.id, s.jobs.countryId))
      .where(and(eq(s.jobs.status, PUB), eq(s.jobs.featured, true), inArray(s.jobs.availability, ["OPEN", "CLOSING_SOON"]))).limit(3),
    db.select({ program: s.programs, uni: { name: s.universities.name, slug: s.universities.slug }, country: { name: s.countries.name, slug: s.countries.slug }, continent: { slug: s.continents.slug } }).from(s.programs)
      .innerJoin(s.universities, eq(s.universities.id, s.programs.universityId))
      .innerJoin(s.countries, eq(s.countries.id, s.universities.countryId))
      .innerJoin(s.continents, eq(s.continents.id, s.countries.continentId))
      .where(and(eq(s.programs.status, PUB), eq(s.programs.featured, true))).limit(3),
    // Expired promotions disappear automatically: only those live right now are returned.
    db.select().from(s.promotions).where(and(eq(s.promotions.status, PUB), lte(s.promotions.startsAt, now), gt(s.promotions.expiresAt, now))).orderBy(asc(s.promotions.expiresAt)),
    db.select().from(s.portfolioEntries).where(eq(s.portfolioEntries.status, PUB)).orderBy(asc(s.portfolioEntries.sortOrder)),
    db.select().from(s.testimonials).where(and(eq(s.testimonials.status, PUB), eq(s.testimonials.consentGiven, true))).orderBy(desc(s.testimonials.createdAt)).limit(6),
    db.select().from(s.newsPosts).where(eq(s.newsPosts.status, PUB)).orderBy(desc(s.newsPosts.publishedAt)).limit(3),
  ]);
  return { featuredJobs, featuredPrograms, promos, portfolio, testimonials, news };
}

export const listNews = () => db.select().from(s.newsPosts).where(eq(s.newsPosts.status, PUB)).orderBy(desc(s.newsPosts.publishedAt));
export const getNews = (slug: string, preview = false) => db.query.newsPosts.findFirst({ where: and(eq(s.newsPosts.slug, slug), preview ? undefined : eq(s.newsPosts.status, PUB)) });
