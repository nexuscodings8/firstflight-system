import { describe, expect, it } from "vitest";
import { formValue, parseFields, uniqueSlug, type Field } from "@/lib/content/fields";
import { ENTITIES } from "@/lib/content/entities";

const run = (fields: Field[], data: Record<string, string>) => parseFields(fields, (n) => data[n] ?? null, (n) => data[n] === "on");

describe("content form parsing", () => {
  it("requires required fields and reports them by label", () => {
    expect(run([{ name: "title", label: "Job title", type: "text", required: true }], {}).error).toBe("Job title is required.");
  });
  it("parses money, whole numbers, tags and checkboxes", () => {
    const r = run([
      { name: "m", label: "Salary", type: "money" }, { name: "n", label: "Order", type: "int" },
      { name: "t", label: "Intakes", type: "tags" }, { name: "c", label: "Featured", type: "checkbox" },
    ], { m: "2,300.5", n: "3", t: "September 2027, January 2028, September 2027", c: "on" });
    expect(r.values).toEqual({ m: "2300.50", n: 3, t: ["September 2027", "January 2028"], c: true });
  });
  it("rejects bad values with a plain explanation", () => {
    expect(run([{ name: "m", label: "Tuition", type: "money" }], { m: "12,000.555" }).error).toMatch(/amount/);
    expect(run([{ name: "u", label: "Website", type: "url" }], { u: "example" }).error).toMatch(/https/);
    expect(run([{ name: "s", label: "Level", type: "select", options: [{ value: "MASTER", label: "Master" }] }], { s: "HACK" }).error).toMatch(/valid level/);
    expect(run([{ name: "c", label: "Destination", type: "country" }], { c: "gb" }).error).toBeDefined();
  });
  it("accepts site paths and full addresses for button links, nothing else", () => {
    const f: Field[] = [{ name: "l", label: "Button link", type: "link" }];
    expect(run(f, { l: "/study" }).values).toEqual({ l: "/study" });
    expect(run(f, { l: "https://example.com/x" }).values).toEqual({ l: "https://example.com/x" });
    expect(run(f, { l: "javascript:alert(1)" }).error).toBeDefined();
    expect(run(f, { l: "//evil.example" }).error).toBeDefined();
  });
  it("stores dates in Kigali time, end-of-day when asked", () => {
    const r = run([{ name: "a", label: "From", type: "date" }, { name: "b", label: "Until", type: "date", endOfDay: true }], { a: "2026-12-01", b: "2026-12-31" });
    expect((r.values!.a as Date).toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect((r.values!.b as Date).toISOString()).toBe("2026-12-31T21:59:00.000Z");
    expect(formValue({ name: "b", label: "", type: "date" }, r.values!.b)).toBe("2026-12-31");
  });
  it("makes unique slugs", () => {
    expect(uniqueSlug("nurse", [])).toBe("nurse");
    expect(uniqueSlug("nurse", ["nurse", "nurse-2"])).toBe("nurse-3");
  });
  it("every entity field list is consistent", () => {
    for (const e of Object.values(ENTITIES)) {
      expect(e.fields.some((f) => f.name === e.titleField)).toBe(true);
      for (const f of e.fields) if (f.type === "ref") expect(Object.keys(ENTITIES)).toContain(f.ref);
    }
  });
});
