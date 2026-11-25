import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { salaryText, tuitionText } from "@/lib/format";
import { formatRef } from "@/lib/ref-format";

describe("redirect safety", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/apply?job=1")).toBe("/apply?job=1");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("/\\evil")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
describe("formatting", () => {
  it("shows salary with currency and pay period", () => {
    expect(salaryText("2300", "2500", "EUR", "MONTH")).toBe("€2,300 – €2,500 per month");
    expect(salaryText("26", "26", "CAD", "HOUR")).toBe("CA$26 per hour");
    expect(salaryText(null, null, "USD", "MONTH")).toBe("Salary on request");
  });
  it("shows tuition with billing period", () => {
    expect(tuitionText("12000", "GBP", "FULL_PROGRAM")).toBe("£12,000 for the full program");
  });
  it("builds readable references", () => {
    expect(formatRef("FF-WA", 2026, 7)).toBe("FF-WA-2026-0007");
  });
});
