import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCountries } from "@/lib/locations";
import { ClientCreateForm } from "@/components/client-create-form";

export const metadata = { title: "Register a client" };

export default async function NewClient({ searchParams }: { searchParams: Promise<{ existing?: string }> }) {
  const me = await requireUser(["CONSULTANT", "ADMIN"], "/staff/clients/new");
  const existingDefault = (await searchParams).existing === "1";
  const can = (sv: string) => me.role === "ADMIN" || (me.services ?? []).includes(sv);
  const [jobs, programs, visas] = await Promise.all([
    can("WORK") ? db.select({ id: s.jobs.id, t: s.jobs.title, c: s.countries.name, av: s.jobs.availability }).from(s.jobs).innerJoin(s.countries, eq(s.countries.id, s.jobs.countryId)).where(eq(s.jobs.status, "PUBLISHED")).orderBy(asc(s.jobs.title)) : [],
    can("STUDY") ? db.select({ id: s.programs.id, t: s.programs.name, c: s.universities.name, av: s.programs.availability }).from(s.programs).innerJoin(s.universities, eq(s.universities.id, s.programs.universityId)).where(eq(s.programs.status, "PUBLISHED")).orderBy(asc(s.programs.name)) : [],
    can("VISA") ? db.select({ id: s.visaGuidance.id, t: s.visaGuidance.title }).from(s.visaGuidance).where(eq(s.visaGuidance.status, "PUBLISHED")).orderBy(asc(s.visaGuidance.title)) : [],
  ]);
  const open = (av: string) => av === "OPEN" || av === "CLOSING_SOON";
  const allListings = [
    ...jobs.map((j) => ({ value: `job:${j.id}`, label: `${j.t} (${j.c})${open(j.av) ? "" : " (closed)"}`, service: "WORK", open: open(j.av) })),
    ...programs.map((p) => ({ value: `program:${p.id}`, label: `${p.t}, ${p.c}${open(p.av) ? "" : " (closed)"}`, service: "STUDY", open: open(p.av) })),
    ...visas.map((v) => ({ value: `visa:${v.id}`, label: v.t, service: "VISA", open: true })),
  ];
  const listings = allListings.filter((l) => l.open);
  const consultants = me.role === "ADMIN" ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true))).orderBy(asc(s.users.name)) : null;
  return (
    <div className="grid max-w-3xl gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Register a client</h1><p className="mt-1 muted">For clients you meet at the office, or existing clients served manually before the platform (they continue from their real stage, not from the beginning). They get an email with a secure link to choose their own password. {me.role === "CONSULTANT" ? "Clients you register are assigned to you." : ""}</p></div>
      <section className="card p-6"><ClientCreateForm listings={listings} allListings={allListings} countries={listCountries().map((c) => ({ iso: c.iso, name: c.name }))} consultants={consultants} existingDefault={existingDefault} /></section>
    </div>
  );
}
