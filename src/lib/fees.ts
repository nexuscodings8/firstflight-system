// Service fee rules and instalment plans: pure functions, unit-tested.

export type Installment = { label: string; percent: number; dueDays: number; condition?: Condition };
export type Scope = { service: string; countryId?: string | null; jobId?: string | null; universityId?: string | null; programId?: string | null; visaCategoryId?: string | null };
export type RuleLike = Scope & { id: string; active: boolean };

/**
 * The agreed fee of one application. The price is locked when the client applies (appliedAt); Finance or Admin
 * then confirms the instalment schedule (confirmedAt). An instalment is invoiced only when its condition is met,
 * so invoiceId stays null until then. Plans made before stage-based invoicing have every invoice already issued
 * and no condition (they count as "INITIAL").
 */
export type Condition = "INITIAL" | "OFFER_LETTER" | "VISA" | `STAGE:${string}`;
export type PlanRow = {
  label: string; amount: string; dueDate: string | null; invoiceId: string | null; invoiceNumber: string | null;
  condition?: Condition; dueDays?: number; loanEligible?: boolean; historical?: boolean; activatedAt?: string | null;
};
export type FeePlan = {
  ruleId: string; ruleName: string; amount: string; currency: string; appliedAt: string; appliedBy: string;
  confirmedAt?: string | null; confirmedBy?: string | null; confirmedById?: string | null;
  installments: PlanRow[];
};
/** Legacy plans (every invoice issued at once) count as confirmed. */
export const planConfirmed = (p: FeePlan | null | undefined) => !!p && (p.confirmedAt !== undefined ? !!p.confirmedAt : p.installments.every((x) => !!x.invoiceId));

/** 1 to 3 instalments, whole percentages adding up to exactly 100, sensible due days. */
export function validateInstallments(list: Installment[]): string | null {
  if (list.length < 1 || list.length > 3) return "Use one, two or three instalments.";
  for (const [i, x] of list.entries()) {
    if (!x.label.trim()) return `Give instalment ${i + 1} a name, e.g. "Deposit".`;
    if (!Number.isInteger(x.percent) || x.percent < 1 || x.percent > 100) return `Instalment ${i + 1} must be a whole percentage between 1 and 100.`;
    if (!Number.isInteger(x.dueDays) || x.dueDays < 0 || x.dueDays > 730) return `Instalment ${i + 1}: days until due must be between 0 and 730.`;
  }
  const total = list.reduce((n, x) => n + x.percent, 0);
  if (total !== 100) return `The instalments add up to ${total}%; they must add up to 100%.`;
  for (let i = 1; i < list.length; i++) if (list[i].dueDays < list[i - 1].dueDays) return "Each instalment must be due on or after the one before it.";
  return null;
}

/** Splits an amount (in cents) by percentages; the last instalment absorbs rounding so the total is exact. */
export function splitAmount(totalCents: number, percents: number[]) {
  const parts = percents.map((p) => Math.floor((totalCents * p) / 100));
  parts[parts.length - 1] += totalCents - parts.reduce((a, b) => a + b, 0);
  return parts;
}

/**
 * How well a rule fits an application: -1 if it doesn't apply, otherwise a higher number for a more specific rule.
 * Job or program (8) > university (4) > visa purpose (2) > country (1) > the service in general (0).
 */
export function specificity(rule: Scope, app: Scope) {
  if (rule.service !== app.service) return -1;
  const fields: [keyof Scope, number][] = [["jobId", 8], ["programId", 8], ["universityId", 4], ["visaCategoryId", 2], ["countryId", 1]];
  let score = 0;
  for (const [f, w] of fields) {
    if (!rule[f]) continue;
    if (rule[f] !== app[f]) return -1;
    score += w;
  }
  return score;
}

/** Active rules that apply to this application, most specific first. */
export function matchingRules<T extends RuleLike>(rules: T[], app: Scope) {
  return rules.filter((r) => r.active).map((r) => ({ r, s: specificity(r, app) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.r);
}

export const addDays = (from: Date, days: number) => new Date(+from + days * 86_400_000);
