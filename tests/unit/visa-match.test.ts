import { describe, expect, it } from "vitest";
import { pickGuidance, type GuidanceCandidate } from "@/lib/visa-match";

const now = new Date("2026-11-25T00:00:00Z");
const g = (o: Partial<GuidanceCandidate> & { id: string }): GuidanceCandidate => ({ destinationCity: null, nationalityIso: null, residenceIso: null, reviewState: "CURRENT", lastCheckedAt: new Date("2026-11-01"), ...o });
const q = { nationality: "RW", residence: "RW", city: "" };

describe("visa guidance matching", () => {
  it("returns a consultation when nothing matches", () => {
    expect(pickGuidance([], q, now)).toMatchObject({ guidance: null, needsConsultation: true, reason: "none" });
  });
  it("prefers nationality-specific over residence-specific over general", () => {
    const r = pickGuidance([g({ id: "any" }), g({ id: "res", residenceIso: "RW" }), g({ id: "nat", nationalityIso: "RW" })], q, now);
    expect(r.guidance?.id).toBe("nat");
  });
  it("ignores entries for other passports or residences", () => {
    const r = pickGuidance([g({ id: "ke", nationalityIso: "KE" }), g({ id: "any" })], q, now);
    expect(r.guidance?.id).toBe("any");
  });
  it("adds city guidance on top of the country entry, only for that city", () => {
    const cands = [g({ id: "country" }), g({ id: "london", destinationCity: "London" })];
    const inLondon = pickGuidance(cands, { ...q, city: "london" }, now);
    expect(inLondon.guidance?.id).toBe("country");
    expect(inLondon.cityExtra?.id).toBe("london");
    const elsewhere = pickGuidance(cands, { ...q, city: "Manchester" }, now);
    expect(elsewhere.guidance?.id).toBe("country");
    expect(elsewhere.cityExtra).toBeNull();
  });
  it("never uses a city entry alone as the checklist", () => {
    expect(pickGuidance([g({ id: "london", destinationCity: "London" })], { ...q, city: "London" }, now)).toMatchObject({ guidance: null, needsConsultation: true });
  });
  it("routes flagged or stale guidance to a consultation", () => {
    expect(pickGuidance([g({ id: "x", reviewState: "NEEDS_REVIEW" })], q, now)).toMatchObject({ needsConsultation: true, reason: "review" });
    expect(pickGuidance([g({ id: "x", lastCheckedAt: new Date("2026-01-01") })], q, now)).toMatchObject({ needsConsultation: true, reason: "stale" });
    expect(pickGuidance([g({ id: "x" })], q, now)).toMatchObject({ needsConsultation: false });
  });
});
