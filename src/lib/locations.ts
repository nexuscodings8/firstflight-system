import "server-only";
import { City, Country } from "country-state-city";

// Offline world dataset behind our own /api/locations endpoints. Swap this module to use a live provider.
export function listCountries() {
  return Country.getAllCountries().map((c) => ({ iso: c.isoCode, name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
}
export function countryName(iso: string) {
  return Country.getCountryByCode(iso)?.name ?? iso;
}
export function listCities(iso: string) {
  const seen = new Set<string>();
  return (City.getCitiesOfCountry(iso) ?? [])
    .map((c) => c.name)
    .filter((n) => (seen.has(n) ? false : (seen.add(n), true)))
    .sort((a, b) => a.localeCompare(b));
}
