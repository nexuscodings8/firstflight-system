import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCountries } from "@/lib/locations";
import { ClientCreateForm } from "@/components/client-create-form";

export const metadata = { title: "Register a client" };

export default async function NewClient() {
  const me = await requireUser(["CONSULTANT", "ADMIN"], "/staff/clients/new");
  const can = (sv: string) => me.role === "ADMIN" || (me.services ?? []).includes(sv);
  const [jobs, programs, visas] = await Promise.all([
    can("WORK") ? db.select({ id: s.jobs.id, t: s.jobs.title, c: s.countries.name }).from(s.jobs).innerJoin(s.countries, eq(s.countries.id, s.jobs.countryId)).where(and(eq(s.jobs.status, "PUBLISHED"), inArray(s.jobs.availability, ["OPEN", "CLOSING_SOON"]))).orderBy(asc(s.jobs.title)) : [],
    can("STUDY") ? db.select({ id: s.programs.id, t: s.programs.name, c: s.universities.name }).from(s.programs).innerJoin(s.universities, eq(s.universities.id, s.programs.universityId)).where(and(eq(s.programs.status, "PUBLISHED"), inArray(s.programs.availability, ["OPEN", "CLOSING_SOON"]))).orderBy(asc(s.programs.name)) : [],
    can("VISA") ? db.select({ id: s.visaGuidance.id, t: s.visaGuidance.title }).from(s.visaGuidance).where(eq(s.visaGuidance.status, "PUBLISHED")).orderBy(asc(s.visaGuidance.title)) : [],
  ]);
  const listings = [
    ...jobs.map((j) => ({ value: `job:${j.id}`, label: `${j.t} (${j.c})`, service: "WORK" })),
    ...programs.map((p) => ({ value: `program:${p.id}`, label: `${p.t}, ${p.c}`, service: "STUDY" })),
    ...visas.map((v) => ({ value: `visa:${v.id}`, label: v.t, service: "VISA" })),
  ];
  return (
    <div className="grid max-w-3xl gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Register a client</h1><p className="mt-1 muted">For clients you meet at the office. They get an activation link to choose their own password. {me.role === "CONSULTANT" ? "If you open an application, a request for you to serve them goes to an administrator; you don't get access until it's approved." : ""}</p></div>
      <section className="card p-6"><ClientCreateForm listings={listings} countries={listCountries().map((c) => ({ iso: c.iso, name: c.name }))} /></section>
    </div>
  );
}
