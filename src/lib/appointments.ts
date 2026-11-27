// Appointment wording shared by the portal and the staff dashboard.
export const APPT_STATUS: Record<string, [string, string]> = {
  PENDING: ["Waiting for the client", "bg-gold/20 text-ink"],
  ACCEPTED: ["Accepted: visiting the office", "bg-emerald-100 text-emerald-800"],
  REMOTE: ["Continuing remotely", "bg-sky-100 text-sky-800"],
  DECLINED: ["Declined", "bg-red-100 text-red-800"],
  COMPLETED: ["Completed", "bg-mist text-brand"],
  CANCELLED: ["Cancelled", "bg-mist muted"],
};
export type OfficeSnap = { address: string; mapsUrl: string; phone: string; hours: string };

/** Parses a date and time typed in Kigali time (UTC+2, no daylight saving). */
export function kigaliToDate(d: string, t: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(t)) return null;
  const x = new Date(`${d}T${t}:00+02:00`);
  return Number.isNaN(+x) ? null : x;
}
