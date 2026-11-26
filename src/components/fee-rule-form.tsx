import { saveFeeRule } from "@/app/staff/finance/fee-actions";
import { CURRENCIES } from "@/lib/finance";
import type { Installment } from "@/lib/fees";
import { ActionForm } from "./action-form";

export type FeeOptions = Record<"countries" | "jobs" | "universities" | "programs" | "visaCategories", { id: string; label: string }[]>;
type Rule = { id: string; name: string; service: string; amount: string; currency: string; installments: unknown; countryId: string | null; jobId: string | null; universityId: string | null; programId: string | null; visaCategoryId: string | null };

const DEFAULT: Installment[] = [{ label: "Deposit", percent: 40, dueDays: 0 }, { label: "Second instalment", percent: 30, dueDays: 30 }, { label: "Final balance", percent: 30, dueDays: 60 }];

export function FeeRuleForm({ rule, options, idPrefix = "new" }: { rule?: Rule; options: FeeOptions; idPrefix?: string }) {
  const inst = (rule?.installments as Installment[] | undefined) ?? DEFAULT;
  const sel = (name: keyof FeeOptions, field: string, text: string, value: string | null | undefined, hint: string) => (
    <div><label className="label" htmlFor={`${idPrefix}-${field}`}>{text} <span className="font-normal muted">({hint})</span></label>
      <select id={`${idPrefix}-${field}`} name={field} defaultValue={value ?? ""} className="input"><option value="">Any</option>{options[name].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
  );
  return (
    <ActionForm action={saveFeeRule} submit={rule ? "Save fee" : "Create fee"} resetOnSuccess={!rule} className="grid gap-4">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className="label" htmlFor={`${idPrefix}-name`}>Fee name</label><input id={`${idPrefix}-name`} name="name" defaultValue={rule?.name} className="input" required maxLength={120} placeholder="e.g. Netherlands work placement" /></div>
        <div><label className="label" htmlFor={`${idPrefix}-service`}>Service</label><select id={`${idPrefix}-service`} name="service" defaultValue={rule?.service ?? "WORK"} className="input"><option value="WORK">Work Abroad</option><option value="STUDY">Study Abroad</option><option value="VISA">Visa Processing</option></select></div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div><label className="label" htmlFor={`${idPrefix}-amount`}>Total fee</label><input id={`${idPrefix}-amount`} name="amount" defaultValue={rule ? Number(rule.amount) : ""} inputMode="decimal" className="input" required /></div>
          <div><label className="label" htmlFor={`${idPrefix}-currency`}>Currency</label><select id={`${idPrefix}-currency`} name="currency" defaultValue={rule?.currency ?? "USD"} className="input">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
      </div>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Applies to (leave &ldquo;Any&rdquo; for the whole service)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {sel("countries", "countryId", "Country", rule?.countryId, "all services")}
          {sel("jobs", "jobId", "Job offer", rule?.jobId, "Work Abroad")}
          {sel("universities", "universityId", "University", rule?.universityId, "Study Abroad")}
          {sel("programs", "programId", "Program", rule?.programId, "Study Abroad")}
          {sel("visaCategories", "visaCategoryId", "Visa purpose", rule?.visaCategoryId, "Visa Processing")}
        </div>
        <p className="mt-2 text-xs muted">When Finance applies a fee plan, the most specific matching fee is suggested: a job or program fee before a university fee, before a visa purpose, before a country, before the general fee.</p>
      </fieldset>
      <fieldset className="rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold">Instalments (one to three, adding up to 100%)</legend>
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_7rem] gap-2">
              <div><label className="label" htmlFor={`${idPrefix}-label${i + 1}`}>Instalment {i + 1} name</label><input id={`${idPrefix}-label${i + 1}`} name={`label${i + 1}`} defaultValue={inst[i]?.label ?? ""} className="input" maxLength={60} placeholder={i ? "Leave empty if not needed" : "e.g. Deposit"} /></div>
              <div><label className="label" htmlFor={`${idPrefix}-percent${i + 1}`}>% of fee</label><input id={`${idPrefix}-percent${i + 1}`} name={`percent${i + 1}`} defaultValue={inst[i]?.percent ?? ""} inputMode="numeric" className="input" /></div>
              <div><label className="label" htmlFor={`${idPrefix}-dueDays${i + 1}`}>Due after (days)</label><input id={`${idPrefix}-dueDays${i + 1}`} name={`dueDays${i + 1}`} defaultValue={inst[i]?.dueDays ?? ""} inputMode="numeric" className="input" /></div>
            </div>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
