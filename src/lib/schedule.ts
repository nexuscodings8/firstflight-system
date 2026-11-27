// Stage-based instalments: when each instalment becomes payable, which stage it guards, loan eligibility, and
// which stage moves are allowed. Pure and unit-tested; the server applies these on every change.
import { STAGES, STAGE_LABEL, type Stage } from "./format";
import type { Condition, FeePlan, PlanRow } from "./fees";

const idx = (st: string) => STAGES.indexOf(st as Stage);
export const MAX_INSTALMENTS = 5;
/** Stages a "payable when the application reaches…" condition may name. */
export const STAGE_CONDITIONS: Stage[] = ["DOCUMENT_SIGNING", "PROCESSING", "GETTING_OFFER", "VISA_PROCESSING", "FINAL_COLLECTION"];
/** Services that receive an offer letter (a visa-only application has none). */
export const needsOffer = (service: string) => service === "WORK" || service === "STUDY";

export const conditionOf = (r: Pick<PlanRow, "condition">): Condition => r.condition ?? "INITIAL";

export function conditionText(c: Condition, who: "client" | "staff" = "client") {
  const your = who === "client" ? "your" : "the";
  if (c === "INITIAL") return who === "client" ? "Payable now (first instalment)" : "At initial invoicing";
  if (c === "OFFER_LETTER") return `Payable after ${your} offer letter is received`;
  if (c === "VISA") return `Payable after ${your} visa is issued`;
  return `Payable when ${your} application reaches ${STAGE_LABEL[c.slice(6)] ?? c.slice(6)}`;
}

/** The stage an application can't enter until this instalment is approved. */
export function gateOf(c: Condition): Stage {
  if (c === "INITIAL") return "DOCUMENT_SIGNING";
  if (c === "OFFER_LETTER") return "VISA_PROCESSING";
  if (c === "VISA") return "FINAL_COLLECTION";
  const i = idx(c.slice(6));
  return STAGES[Math.min(i + 1, STAGES.length - 1)];
}

export type Ctx = { stage: string; offerLetter: boolean; visa: boolean };
/** Whether an instalment's payment condition has been reached (so it may be invoiced). */
export function conditionMet(c: Condition, x: Ctx) {
  if (c === "INITIAL") return idx(x.stage) >= idx("INITIAL_PAYMENT");
  if (c === "OFFER_LETTER") return x.offerLetter;
  if (c === "VISA") return x.visa;
  return idx(x.stage) >= idx(c.slice(6));
}

/** Loans are allowed only on the third and final instalment of a schedule with exactly three instalments. */
export const loanAllowed = (plan: Pick<FeePlan, "installments"> | null | undefined, i: number) =>
  !!plan && plan.installments.length === 3 && i === 2 && !!plan.installments[2]?.loanEligible;

export type DraftRow = { label: string; cents: number; condition: Condition; dueDays: number; loanEligible: boolean; historical: boolean };
/** Checks a schedule Finance or Admin is about to confirm. Returns an error message, or null. */
export function validateSchedule(totalCents: number, rows: DraftRow[], service: string): string | null {
  if (totalCents <= 0) return "Enter the total agreed service fee.";
  if (rows.length < 1 || rows.length > MAX_INSTALMENTS) return `Use between 1 and ${MAX_INSTALMENTS} instalments.`;
  for (const [i, r] of rows.entries()) {
    const n = `Instalment ${i + 1}`;
    if (!r.label.trim()) return `Give ${n.toLowerCase()} a name, e.g. "Deposit".`;
    if (!Number.isInteger(r.cents) || r.cents <= 0) return `${n} needs an amount above zero.`;
    if (!Number.isInteger(r.dueDays) || r.dueDays < 0 || r.dueDays > 365) return `${n}: days to pay must be between 0 and 365.`;
    const okCond = r.condition === "INITIAL" || r.condition === "OFFER_LETTER" || r.condition === "VISA" || (r.condition.startsWith("STAGE:") && STAGE_CONDITIONS.includes(r.condition.slice(6) as Stage));
    if (!okCond) return `${n}: choose when it becomes payable.`;
    if (r.condition === "OFFER_LETTER" && !needsOffer(service)) return `${n}: this service has no offer letter. Choose another condition.`;
    if (r.loanEligible && !(rows.length === 3 && i === 2)) return "A loan can only be allowed on the third and final instalment of a schedule with exactly three instalments.";
  }
  if (!rows[0].historical && rows[0].condition !== "INITIAL") return "The first instalment is always payable at initial invoicing.";
  const sum = rows.reduce((t, r) => t + r.cents, 0);
  if (sum !== totalCents) return `The instalments add up to ${(sum / 100).toFixed(2)}, but the agreed fee is ${(totalCents / 100).toFixed(2)}. They must match exactly.`;
  return null;
}

export type GateRow = { label: string; condition: Condition; invoiced: boolean; paid: boolean };
export type GateFacts = {
  service: string; contractSigned: boolean; offerLetter: boolean; visa: boolean;
  /** null when there is no schedule; then the legacy invoice rules apply. */
  rows: GateRow[] | null; scheduleConfirmed: boolean; legacyFirstPaid: boolean; legacyAllPaid: boolean;
};

/** Why the application can't move to `target` (or be completed), or null if it can. Checked for forward moves. */
export function stageBlock(target: string, completing: boolean, f: GateFacts): string | null {
  const t = completing ? STAGES.length - 1 : idx(target);
  if (f.rows && f.scheduleConfirmed) {
    for (const [i, r] of f.rows.entries()) {
      if (r.paid) continue;
      if (!completing && t < idx(gateOf(r.condition))) continue; // not due yet: never blocks
      const n = `Instalment ${i + 1} (${r.label})`;
      if (i === 0) return "Finance hasn't approved the first instalment yet. The application moves on automatically once they do.";
      return r.invoiced ? `${n} must be paid and approved by Finance first. It became payable ${conditionText(r.condition, "staff").replace("Payable ", "")}.`
        : `${n} is ${conditionText(r.condition, "staff").toLowerCase()}; that hasn't happened yet, so the application can't move past it.`;
    }
  } else if (f.rows && !f.scheduleConfirmed) {
    if (t >= idx("DOCUMENT_SIGNING")) return "Finance hasn't confirmed the instalment schedule and approved the first instalment yet.";
  } else {
    if (t >= idx("DOCUMENT_SIGNING") && !f.legacyFirstPaid) return "Finance hasn't approved the first instalment yet. The application moves on automatically once they do.";
    if (t >= idx("FINAL_COLLECTION") && !f.legacyAllPaid) return "All instalments must be approved by Finance before Final collection.";
  }
  if (t >= idx("PROCESSING") && !f.contractSigned) return "The client's contract isn't signed yet. Ask them to sign online, or upload the signed paper copy.";
  if (t >= idx("VISA_PROCESSING") && needsOffer(f.service) && !f.offerLetter) return "Upload the client's offer letter before moving on from Getting offer.";
  if (t >= idx("FINAL_COLLECTION") && !f.visa) return "Record the client's visa before Final collection.";
  return null;
}
