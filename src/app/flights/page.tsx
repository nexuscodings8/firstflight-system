import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listCountries } from "@/lib/locations";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FlightForm } from "@/components/flight-form";

export const metadata: Metadata = { title: "Flight bookings", description: "Tell FIRST FLIGHT where and when you want to fly; a consultant sends you flight options and prices." };

export default async function FlightsPage() {
  const user = await getCurrentUser();
  return (
    <div className="wrap max-w-4xl pb-14">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Flight bookings" }]} />
      <h1 className="text-3xl sm:text-4xl">Book a flight</h1>
      <p className="mt-2 max-w-2xl text-lg muted">Tell us your route, dates and travellers. A FIRST FLIGHT consultant will send you the best options and prices, usually within one working day. Nothing is booked or paid until you confirm.</p>
      <div className="card mt-6 p-6 sm:p-8"><FlightForm countries={listCountries().map((c) => ({ iso: c.iso, name: c.name }))} user={user ? { name: user.name, email: user.email } : null} /></div>
    </div>
  );
}
