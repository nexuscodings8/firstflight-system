import { describe, expect, it } from "vitest";
import { matchingRules, specificity, splitAmount, validateInstallments } from "@/lib/fees";

describe("fee rules", () => {
  it("validates instalments", () => {
    expect(validateInstallments([{ label: "Deposit", percent: 40, dueDays: 0 }, { label: "Balance", percent: 60, dueDays: 30 }])).toBeNull();
    expect(validateInstallments([{ label: "A", percent: 50, dueDays: 0 }, { label: "B", percent: 40, dueDays: 10 }])).toMatch(/add up to 90%/);
    expect(validateInstallments([])).toMatch(/one, two or three/);
    expect(validateInstallments([1, 2, 3, 4].map((i) => ({ label: `I${i}`, percent: 25, dueDays: i })))).toMatch(/one, two or three/);
    expect(validateInstallments([{ label: "A", percent: 50, dueDays: 30 }, { label: "B", percent: 50, dueDays: 10 }])).toMatch(/on or after/);
  });
  it("splits amounts exactly", () => {
    expect(splitAmount(100000, [33, 33, 34])).toEqual([33000, 33000, 34000]);
    expect(splitAmount(1001, [50, 50])).toEqual([500, 501]);
    const parts = splitAmount(99999, [30, 30, 40]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(99999);
  });
  it("picks the most specific active rule", () => {
    const app = { service: "WORK", countryId: "nl", jobId: "j1" };
    const rules = [
      { id: "general", service: "WORK", active: true },
      { id: "country", service: "WORK", countryId: "nl", active: true },
      { id: "job", service: "WORK", countryId: "nl", jobId: "j1", active: true },
      { id: "otherJob", service: "WORK", jobId: "j2", active: true },
      { id: "inactive", service: "WORK", jobId: "j1", active: false },
      { id: "study", service: "STUDY", active: true },
    ];
    expect(matchingRules(rules, app).map((r) => r.id)).toEqual(["job", "country", "general"]);
    expect(specificity({ service: "VISA", visaCategoryId: "tourist" }, { service: "VISA", visaCategoryId: "business" })).toBe(-1);
  });
});
