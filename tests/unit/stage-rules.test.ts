import { describe, expect, it } from "vitest";
import { paymentFacts, stageBlock } from "@/lib/stage-rules";

describe("stage locks", () => {
  const none = { firstPaid: false, contractSigned: false, allPaid: false };
  it("blocks payment-dependent stages until Finance approves", () => {
    expect(stageBlock("ELIGIBILITY_REVIEW", false, none)).toBeNull();
    expect(stageBlock("INITIAL_PAYMENT", false, none)).toBeNull();
    expect(stageBlock("DOCUMENT_SIGNING", false, none)).toMatch(/first instalment/);
    expect(stageBlock("PROCESSING", false, { ...none, firstPaid: true })).toMatch(/contract/);
    expect(stageBlock("PROCESSING", false, { ...none, firstPaid: true, contractSigned: true })).toBeNull();
    expect(stageBlock("FINAL_COLLECTION", false, { firstPaid: true, contractSigned: true, allPaid: false })).toMatch(/All instalments/);
    expect(stageBlock("SUBMITTED", true, { firstPaid: true, contractSigned: true, allPaid: false })).toMatch(/All instalments/);
    expect(stageBlock("FINAL_COLLECTION", false, { firstPaid: true, contractSigned: true, allPaid: true })).toBeNull();
  });
  it("uses the fee plan's first invoice as the first instalment", () => {
    const d = (n: number) => new Date(2026, 0, n);
    const inv = [{ id: "manual", status: "PAID", createdAt: d(1) }, { id: "p1", status: "ISSUED", createdAt: d(2) }, { id: "p2", status: "ISSUED", createdAt: d(3) }];
    expect(paymentFacts(inv, "p1")).toEqual({ firstPaid: false, allPaid: false });
    expect(paymentFacts(inv, null).firstPaid).toBe(true);
    expect(paymentFacts([{ id: "v", status: "VOID", createdAt: d(1) }], null)).toEqual({ firstPaid: false, allPaid: false });
  });
});
