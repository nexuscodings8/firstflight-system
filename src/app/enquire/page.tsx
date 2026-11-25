import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { countryName } from "@/lib/locations";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EnquiryForm } from "@/components/enquiry-form";

export const metadata: Metadata = { title: "Speak to a consultant" };
const TITLES: Record<string, string> = { PROGRAM_GUIDANCE: "Request study guidance", VISA_CONSULTATION: "Request a visa consultation", JOB_QUESTION: "Ask about a job", GENERAL: "Speak to a consultant" };
const ISO = /^[A-Z]{2}$/;

export default async function EnquirePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const type = q.type && TITLES[q.type] ? q.type : "GENERAL";
  const user = await getCurrentUser();
  // Carry the visitor's selection into the enquiry, resolved on the server from ids and ISO codes.
  const shown: [string, string][] = [];
  const context: Record<string, unknown> = { type };
  if (q.program) {
    const p = await db.query.programs.findFirst({ where: and(eq(s.programs.id, q.program), eq(s.programs.status, "PUBLISHED")), with: { university: { with: { country: true } } } });
    if (p) { Object.assign(context, { programId: p.id, program: p.name, university: p.university.name, country: p.university.country.name }); shown.push(["Program", p.name], ["University", p.university.name], ["Country", p.university.country.name]); }
  }
  if (q.job) {
    const j = await db.query.jobs.findFirst({ where: and(eq(s.jobs.id, q.job), eq(s.jobs.status, "PUBLISHED")), with: { country: true } });
    if (j) { Object.assign(context, { jobId: j.id, job: j.title, country: j.country.name }); shown.push(["Job", j.title], ["Country", j.country.name]); }
  }
  if (type === "VISA_CONSULTATION") {
    const v = { nat: q.nat?.toUpperCase(), res: q.res?.toUpperCase(), dest: q.dest?.toUpperCase(), city: q.city?.slice(0, 80), purpose: q.purpose };
    if (v.nat && ISO.test(v.nat)) shown.push(["Passport", countryName(v.nat)]);
    if (v.res && ISO.test(v.res)) shown.push(["Residence", countryName(v.res)]);
    if (v.dest && ISO.test(v.dest)) shown.push(["Destination", `${v.city ? v.city + ", " : ""}${countryName(v.dest)}`]);
    if (v.purpose) shown.push(["Purpose", v.purpose.replace(/-/g, " ")]);
    context.visa = v;
  }
  return (
    <div className="wrap max-w-4xl">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: TITLES[type] }]} />
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl">{TITLES[type]}</h1>
        <p className="mt-2 muted">A FIRST FLIGHT consultant will reply by email or phone.</p>
        {shown.length > 0 && <dl className="mt-5 grid gap-3 rounded-xl bg-mist p-4 sm:grid-cols-2">{shown.map(([k, v]) => <div key={k}><dt className="text-xs muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>}
        <div className="mt-6"><EnquiryForm type={type} context={context} user={user} /></div>
      </div>
    </div>
  );
}
