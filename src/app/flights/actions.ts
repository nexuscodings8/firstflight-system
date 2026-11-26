"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createEnquiry } from "@/lib/enquiries";
import { countryName } from "@/lib/locations";
import { clientIp, hit } from "@/lib/rate-limit";

export type FlightState = { error?: string } | undefined;
const ISO = z.string().regex(/^[A-Z]{2}$/, "Choose a country");
const Schema = z.object({
  fromCountry: ISO, fromCity: z.string().trim().min(2, "Enter the departure city").max(80),
  toCountry: ISO, toCity: z.string().trim().min(2, "Enter the destination city").max(80),
  trip: z.enum(["ONE_WAY", "RETURN"]),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the travel date"),
  returnDate: z.string().optional(),
  adults: z.coerce.number().int().min(1, "At least one adult travels").max(9),
  children: z.coerce.number().int().min(0).max(8),
  infants: z.coerce.number().int().min(0).max(4),
  travelClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().min(6, "Enter a phone or WhatsApp number so we can send options quickly").max(30),
  notes: z.string().trim().max(1000).optional(),
});
const CLASS = { ECONOMY: "Economy", PREMIUM_ECONOMY: "Premium economy", BUSINESS: "Business", FIRST: "First" } as const;

export async function submitFlight(_: FlightState, fd: FormData): Promise<FlightState> {
  const p = Schema.safeParse(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]).filter(([, v]) => v !== "")));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const today = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10);
  if (d.departDate < today) return { error: "The travel date can't be in the past." };
  if (d.trip === "RETURN" && (!d.returnDate || d.returnDate < d.departDate)) return { error: "Choose a return date on or after the travel date." };
  if (d.fromCountry === d.toCountry && d.fromCity.toLowerCase() === d.toCity.toLowerCase()) return { error: "Departure and destination are the same." };
  if (d.infants > d.adults) return { error: "Each infant must travel with an adult." };
  if (!hit(`enquiry:${await clientIp()}`, 8, 3_600_000).ok) return { error: "You've sent several requests in the last hour. Please call or WhatsApp us instead." };
  const from = `${d.fromCity}, ${countryName(d.fromCountry)}`, to = `${d.toCity}, ${countryName(d.toCountry)}`;
  const pax = [`${d.adults} adult${d.adults === 1 ? "" : "s"}`, d.children ? `${d.children} child${d.children === 1 ? "" : "ren"}` : "", d.infants ? `${d.infants} infant${d.infants === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
  const message = `Flight request: ${from} → ${to}, ${d.trip === "RETURN" ? `return ${d.departDate} to ${d.returnDate}` : `one way on ${d.departDate}`}, ${pax}, ${CLASS[d.travelClass]}.${d.notes ? `\n\n${d.notes}` : ""}`;
  const context = { flight: { from, to, trip: d.trip === "RETURN" ? "Return" : "One way", depart: d.departDate, return: d.trip === "RETURN" ? d.returnDate : undefined, passengers: pax, class: CLASS[d.travelClass] } };
  const ref = await createEnquiry({ type: "FLIGHT_BOOKING", name: d.name, email: d.email, phone: d.phone, message }, context, await getCurrentUser(), "the flight request form");
  redirect(`/enquire/thanks?ref=${ref}`);
}
