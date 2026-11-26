import { describe, expect, it } from "vitest";
import { detectIntent, findCountry, findLevel, keywords } from "@/lib/assistant/intent";

const countries = [{ name: "United Kingdom", iso: "GB" }, { name: "Canada", iso: "CA" }, { name: "Netherlands", iso: "NL" }, { name: "United Arab Emirates", iso: "AE" }];

describe("assistant understanding", () => {
  it.each([
    ["Hello", "greeting"], ["Any nursing jobs in Canada?", "jobs"], ["I want to study a masters in the UK", "study"],
    ["Do I need a visa for the Netherlands?", "visa"], ["How much does it cost?", "fees"], ["What is the status of my application", "track"],
    ["Can I talk to a consultant?", "human"], ["What documents do I need", "documents"], ["Where is your office?", "contact"],
    ["How do I apply?", "apply"], ["thanks!", "thanks"], ["purple elephants", "unknown"],
    ["How much is tuition in Canada?", "fees"],
  ])("%s → %s", (msg, intent) => expect(detectIntent(msg)).toBe(intent));
  it("finds countries by name and common short names", () => {
    expect(findCountry("jobs in canada please", countries)?.iso).toBe("CA");
    expect(findCountry("study in the UK", countries)?.iso).toBe("GB");
    expect(findCountry("work in Dubai", countries)?.iso).toBe("AE");
    expect(findCountry("anything abroad", countries)).toBeNull();
  });
  it("picks search words and levels", () => {
    expect(keywords("Any nursing jobs in Canada?", "Canada")).toEqual(["nursing"]);
    expect(findLevel("a masters in business")).toBe("MASTER");
    expect(findLevel("bachelor degree")).toBe("BACHELOR");
  });
});
