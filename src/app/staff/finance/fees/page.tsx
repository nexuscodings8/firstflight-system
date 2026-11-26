import Link from "next/link";
import { asc, desc, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import type { Installment } from "@/lib/fees";
import { SERVICE_LABEL, money } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { FeeRuleForm, type FeeOptions } from "@/components/fee-rule-form";
import { Empty } from "@/components/cards";
import { toggleFeeRule } from "../fee-actions";

export const metadata = { title: "Service fees" };

export default async function FeesPage() {
  await requireUser(["FINANCE", "ADMIN"], "/staff/finance/fees");
  const [rules, countries, jobs, unis, programs, cats] = await Promise.all([
    db.select().from(s.feeRules).orderBy(desc(s.feeRules.active), asc(s.feeRules.service), asc(s.feeRules.name)),
    db.select({ id: s.countries.id, label: s.countries.name }).from(s.countries).where(ne(s.countries.status, "ARCHIVED")).orderBy(asc(s.countries.name)),
    db.select({ id: s.jobs.id, label: s.jobs.title }).from(s.jobs).where(ne(s.jobs.status, "ARCHIVED")).orderBy(asc(s.jobs.title)),
    db.select({ id: s.universities.id, label: s.universities.name }).from(s.universities).where(ne(s.universities.status, "ARCHIVED")).orderBy(asc(s.universities.name)),
    db.select({ id: s.programs.id, label: s.programs.name }).from(s.programs).where(ne(s.programs.status, "ARCHIVED")).orderBy(asc(s.programs.name)),
    db.select({ id: s.visaCategories.id, label: s.visaCategories.name }).from(s.visaCategories).orderBy(asc(s.visaCategories.sortOrder)),
  ]);
  const options: FeeOptions = { countries, jobs, universities: unis, programs, visaCategories: cats };
  const name = (list: { id: string; label: string }[], id: string | null) => list.find((x) => x.id === id)?.label;
  return (
    <div className="grid gap-6">
      <Link href="/staff/finance" className="text-sm font-semibold text-brand">← Finance</Link>
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Service fees</h1><p className="mt-1 max-w-2xl muted">Fees are private: visitors never see them. Clients see only the fee plan applied to their own application. Changing a fee here never changes a plan already applied, and every change is recorded in the activity history.</p></div>
      <section className="card p-5"><h2 className="mb-3 text-xl">New fee</h2><FeeRuleForm options={options} /></section>
      <section className="grid gap-3">
        <h2 className="text-xl">Fees</h2>
        {rules.map((r) => {
          const scope = [name(countries, r.countryId), name(jobs, r.jobId), name(unis, r.universityId), name(programs, r.programId), name(cats, r.visaCategoryId)].filter(Boolean).join(" · ") || "All applications for this service";
          const inst = r.installments as Installment[];
          return (
            <article key={r.id} className={`card p-5 ${r.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{r.name}</p><p className="text-sm muted">{SERVICE_LABEL[r.service]} · {scope}</p></div>
                <div className="text-right"><p className="font-display text-xl font-extrabold">{money(r.amount, r.currency)}</p><span className={`badge ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{r.active ? "Offered" : "Not offered"}</span></div>
              </div>
              <p className="mt-2 text-sm">{inst.map((x) => `${x.label} ${x.percent}% (due ${x.dueDays ? `after ${x.dueDays} days` : "immediately"})`).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <details className="flex-1"><summary className="cursor-pointer text-sm font-semibold text-brand">Edit {r.name}</summary><div className="mt-3"><FeeRuleForm rule={r} options={options} idPrefix={r.id} /></div></details>
                <ActionForm action={toggleFeeRule} submit={r.active ? "Stop offering" : "Offer again"} className="grid" buttonClass="btn-ghost btn-sm" resetOnSuccess={false}><input type="hidden" name="id" value={r.id} /></ActionForm>
              </div>
            </article>
          );
        })}
        {!rules.length && <Empty title="No fees yet" />}
      </section>
    </div>
  );
}
