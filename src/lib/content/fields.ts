// Field definitions and parsing for the Content Manager forms. Pure functions: no database, unit-tested.

export type Option = { value: string; label: string };
export type FieldType = "text" | "textarea" | "int" | "money" | "date" | "select" | "ref" | "country" | "checkbox" | "tags" | "url" | "link";

export type Field = {
  name: string; // database property name (drizzle camelCase)
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number; // max characters for text
  help?: string;
  options?: Option[]; // select
  ref?: string; // ref: entity key whose rows are offered
  optionalLabel?: string; // select/ref/country: label for the empty choice when not required
  endOfDay?: boolean; // date: store 23:59 Kigali time instead of 00:00
  wide?: boolean; // span the full form width
};

export type Values = Record<string, unknown>;
export type ParseResult = { values: Values; error?: undefined } | { error: string; values?: undefined };

const KIGALI = "+02:00";

/** Converts submitted form data into typed column values, or returns the first problem in plain words. */
export function parseFields(fields: Field[], get: (name: string) => string | null, has: (name: string) => boolean): ParseResult {
  const values: Values = {};
  for (const f of fields) {
    const raw = (get(f.name) ?? "").trim();
    const empty = raw === "";
    if (f.type === "checkbox") { values[f.name] = has(f.name); continue; }
    if (empty) {
      if (f.required) return { error: `${f.label} is required.` };
      values[f.name] = f.type === "tags" ? [] : null;
      continue;
    }
    if (f.max && raw.length > f.max) return { error: `${f.label} must be ${f.max} characters or fewer.` };
    switch (f.type) {
      case "int": {
        if (!/^-?\d{1,9}$/.test(raw)) return { error: `${f.label} must be a whole number.` };
        values[f.name] = Number(raw);
        break;
      }
      case "money": {
        const t = raw.replace(/[,\s]/g, "");
        if (!/^\d{1,10}(\.\d{1,2})?$/.test(t)) return { error: `${f.label} must be an amount like 1200 or 1200.50.` };
        values[f.name] = Number(t).toFixed(2);
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: `${f.label} must be a date.` };
        const d = new Date(`${raw}T${f.endOfDay ? "23:59:00" : "00:00:00"}${KIGALI}`);
        if (Number.isNaN(d.getTime())) return { error: `${f.label} must be a valid date.` };
        values[f.name] = d;
        break;
      }
      case "select": {
        if (!f.options?.some((o) => o.value === raw)) return { error: `Choose a valid ${f.label.toLowerCase()}.` };
        values[f.name] = raw;
        break;
      }
      case "country": {
        if (!/^[A-Z]{2}$/.test(raw)) return { error: `Choose a country for ${f.label.toLowerCase()}.` };
        values[f.name] = raw;
        break;
      }
      case "url": {
        if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(raw)) return { error: `${f.label} must be a full web address starting with https://` };
        values[f.name] = raw;
        break;
      }
      case "link": {
        // A page on this site ("/visa") or a full web address.
        if (!/^\/[^\s/][^\s]*$|^\/$/.test(raw) && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(raw)) return { error: `${f.label} must be a page on this site (like /study) or a full address starting with https://` };
        values[f.name] = raw;
        break;
      }
      case "tags": {
        const list = [...new Set(raw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
        if (list.some((x) => x.length > 60)) return { error: `Each entry in ${f.label} must be 60 characters or fewer.` };
        values[f.name] = list;
        break;
      }
      default:
        values[f.name] = raw; // text, textarea, ref (checked against the database by the caller)
    }
  }
  return { values };
}

/** The value to show in an input for an existing record. */
export function formValue(f: Field, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (f.type === "date" && v instanceof Date) return new Date(+v + 2 * 3_600_000).toISOString().slice(0, 10);
  if (f.type === "tags" && Array.isArray(v)) return v.join(", ");
  if (f.type === "money") return String(Number(v));
  return String(v);
}

/** Next free slug: "base", then "base-2", "base-3"… */
export function uniqueSlug(base: string, taken: string[]) {
  const b = base || "item";
  const set = new Set(taken);
  if (!set.has(b)) return b;
  for (let i = 2; ; i++) if (!set.has(`${b}-${i}`)) return `${b}-${i}`;
}

export const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));
