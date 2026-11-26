import "server-only";
import type { Entity } from "./entities";
import type { Option } from "./fields";
import { refOptions } from "./store";
import { listCountries } from "../locations";

/** Choices for every ref and country field of an entity. */
export async function fieldOptions(e: Entity) {
  const out: Record<string, Option[]> = {};
  const countries = e.fields.some((f) => f.type === "country") ? listCountries().map((c) => ({ value: c.iso, label: c.name })) : [];
  for (const f of e.fields) {
    if (f.type === "ref") out[f.name] = await refOptions(f.ref!);
    if (f.type === "country") out[f.name] = countries;
  }
  return out;
}
