import { describe, expect, it } from "vitest";
import { paymentFacts } from "@/lib/stage-rules";
import { conditionMet, gateOf, loanAllowed, stageBlock, validateSchedule, type GateFacts, type GateRow } from "@/lib/schedule";

const base: GateFacts = { service: "WORK", contractSigned: false, offerLetter: false, visa: false, rows: null, scheduleConfirmed: false, legacyFirstPaid: false, legacyAllPaid: false };
const row = (condition: GateRow["condition"], paid: boolean, invoiced = paid): GateRow => ({ label: "x", condition, invoiced, paid });

describe("stage gates with a confirmed schedule", () => {
  const sched = (rows: GateRow[], extra: Partial<GateFacts> = {}): GateFacts => ({ ...base, rows, scheduleConfirmed: true, ...extra });
  it("locks Contract signing until the first instalment is approved", () => {
    expect(stageBlock("DOCUMENT_SIGNING", false, sched([row("INITIAL", false, true)]))).toMatch(/first instalment/);
    expect(stageBlock("DOCUMENT_SIGNING", false, sched([row("INITIAL", true)]))).toBeNull();
  });
  it("needs the signed contract for Processing", () => {
    expect(stageBlock("PROCESSING", false, sched([row("INITIAL", true)]))).toMatch(/contract/);
    expect(stageBlock("PROCESSING", false, sched([row("INITIAL", true)], { contractSigned: true }))).toBeNull();
  });
  it("an instalment due after the offer letter blocks Visa processing until paid", () => {
    const f = sched([row("INITIAL", true), row("OFFER_LETTER", false, true)], { contractSigned: true, offerLetter: true });
    expect(stageBlock("GETTING_OFFER", false, f)).toBeNull();
    expect(stageBlock("VISA_PROCESSING", false, f)).toMatch(/Instalment 2/);
  });
  it("an instalment due after the visa never blocks the stages before it", () => {
    const f = sched([row("INITIAL", true), row("VISA", false, false)], { contractSigned: true, offerLetter: true });
    expect(stageBlock("GETTING_OFFER", false, f)).toBeNull();
    expect(stageBlock("VISA_PROCESSING", false, f)).toBeNull();
    expect(stageBlock("FINAL_COLLECTION", false, { ...f, visa: true })).toMatch(/Instalment 2/);
    expect(stageBlock("FINAL_COLLECTION", false, { ...f, visa: true, rows: [row("INITIAL", true), row("VISA", true)] })).toBeNull();
  });
  it("needs the offer letter (work and study) and the visa", () => {
    const f = sched([row("INITIAL", true)], { contractSigned: true });
    expect(stageBlock("VISA_PROCESSING", false, f)).toMatch(/offer letter/);
    expect(stageBlock("VISA_PROCESSING", false, { ...f, service: "VISA" })).toBeNull();
    expect(stageBlock("FINAL_COLLECTION", false, { ...f, offerLetter: true })).toMatch(/visa/);
  });
  it("completing needs every instalment paid", () => {
    const f = sched([row("INITIAL", true), row("STAGE:FINAL_COLLECTION", false, true)], { contractSigned: true, offerLetter: true, visa: true });
    expect(stageBlock("COMPLETED", true, f)).toMatch(/Instalment 2/);
  });
  it("an unconfirmed schedule blocks Contract signing", () => {
    expect(stageBlock("DOCUMENT_SIGNING", false, { ...base, rows: [row("INITIAL", false, false)] })).toMatch(/schedule/);
  });
});

describe("legacy invoices (no schedule)", () => {
  it("keeps the earlier rules", () => {
    expect(stageBlock("DOCUMENT_SIGNING", false, base)).toMatch(/first instalment/);
    expect(stageBlock("FINAL_COLLECTION", false, { ...base, legacyFirstPaid: true, contractSigned: true, offerLetter: true, visa: true })).toMatch(/All instalments/);
  });
  it("paymentFacts uses the plan's first invoice", () => {
    const inv = [{ id: "a", status: "ISSUED", createdAt: new Date(1) }, { id: "b", status: "PAID", createdAt: new Date(2) }];
    expect(paymentFacts(inv, "b").firstPaid).toBe(true);
    expect(paymentFacts(inv, null).firstPaid).toBe(false);
  });
});

describe("conditions", () => {
  it("gates and activation", () => {
    expect(gateOf("STAGE:PROCESSING")).toBe("GETTING_OFFER");
    expect(gateOf("VISA")).toBe("FINAL_COLLECTION");
    expect(conditionMet("STAGE:GETTING_OFFER", { stage: "PROCESSING", offerLetter: false, visa: false })).toBe(false);
    expect(conditionMet("STAGE:GETTING_OFFER", { stage: "GETTING_OFFER", offerLetter: false, visa: false })).toBe(true);
    expect(conditionMet("OFFER_LETTER", { stage: "GETTING_OFFER", offerLetter: true, visa: false })).toBe(true);
    expect(conditionMet("INITIAL", { stage: "ELIGIBILITY_REVIEW", offerLetter: false, visa: false })).toBe(false);
  });
});

describe("loan eligibility", () => {
  const plan = (n: number, loanOn: number | null) => ({ installments: Array.from({ length: n }, (_, i) => ({ label: "x", amount: "1", dueDate: null, invoiceId: null, invoiceNumber: null, loanEligible: i === loanOn })) });
  it("only the third instalment of exactly three, when Finance allowed it", () => {
    expect(loanAllowed(plan(1, 0), 0)).toBe(false);
    expect(loanAllowed(plan(2, 1), 1)).toBe(false);
    expect(loanAllowed(plan(3, 2), 0)).toBe(false);
    expect(loanAllowed(plan(3, 2), 1)).toBe(false);
    expect(loanAllowed(plan(3, 2), 2)).toBe(true);
    expect(loanAllowed(plan(3, null), 2)).toBe(false);
    expect(loanAllowed(plan(4, 2), 2)).toBe(false);
  });
});

describe("validateSchedule", () => {
  const r = (cents: number, condition: GateRow["condition"] = "INITIAL", extra = {}) => ({ label: "x", cents, condition, dueDays: 7, loanEligible: false, historical: false, ...extra });
  it("instalments must add up to the total exactly", () => {
    expect(validateSchedule(100000000, [r(40000000), r(30000000, "OFFER_LETTER"), r(30000000, "VISA")], "WORK")).toBeNull();
    expect(validateSchedule(100000000, [r(40000000), r(30000000, "OFFER_LETTER"), r(29999900, "VISA")], "WORK")).toMatch(/must match/);
  });
  it("rejects loans anywhere but the third of three, offer letters for visa-only, and a late first instalment", () => {
    expect(validateSchedule(300, [r(100), r(100, "VISA", { loanEligible: true }), r(100, "VISA")], "WORK")).toMatch(/third and final/);
    expect(validateSchedule(400, [r(100), r(100, "VISA"), r(100, "VISA", { loanEligible: true }), r(100, "VISA")], "WORK")).toMatch(/third and final/);
    expect(validateSchedule(200, [r(100), r(100, "OFFER_LETTER")], "VISA")).toMatch(/no offer letter/);
    expect(validateSchedule(200, [r(100, "VISA"), r(100)], "WORK")).toMatch(/first instalment/);
  });
});
