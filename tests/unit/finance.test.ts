import { describe, expect, it } from "vitest";
import { balanceOf, monthRange, normaliseRef, parseAmount, statusAfterPayments } from "@/lib/finance";

describe("finance rules", () => {
  it("parses amounts typed by staff", () => {
    expect(parseAmount("1,250.50")).toBe(125050);
    expect(parseAmount("300")).toBe(30000);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("12.345")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("moves invoice status with payments", () => {
    expect(statusAfterPayments("ISSUED", 10000, 0)).toBe("ISSUED");
    expect(statusAfterPayments("ISSUED", 10000, 4000)).toBe("PARTIALLY_PAID");
    expect(statusAfterPayments("PARTIALLY_PAID", 10000, 10000)).toBe("PAID");
    expect(statusAfterPayments("VOID", 10000, 10000)).toBe("VOID");
  });
  it("computes balances and ignores void invoices", () => {
    expect(balanceOf({ amount: "500.00", status: "PARTIALLY_PAID", payments: [{ amount: "200.00" }, { amount: "50.50" }] })).toEqual({ total: 50000, paid: 25050, due: 24950 });
    expect(balanceOf({ amount: "500.00", status: "VOID", payments: [] }).due).toBe(0);
  });
  it("treats payment references with different spacing or case as the same", () => {
    expect(normaliseRef(" mp 123-abc ")).toBe("MP123-ABC");
  });
  it("uses Kigali month boundaries", () => {
    const [a, b] = monthRange("2026-12")!;
    expect(a.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(b.toISOString()).toBe("2026-12-31T22:00:00.000Z");
    expect(monthRange("2026-13")).toBeNull();
  });
});
