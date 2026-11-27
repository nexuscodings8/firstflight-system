const PERIOD: Record<string, string> = { HOUR: "per hour", DAY: "per day", WEEK: "per week", MONTH: "per month", YEAR: "per year", SEMESTER: "per semester", TERM: "per term", FULL_PROGRAM: "for the full program" };

export function money(amount: string | number | null | undefined, currency: string) {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-US")}`;
  }
}

export function salaryText(min: string | null, max: string | null, currency: string, period: string) {
  const a = money(min, currency), b = money(max, currency);
  if (!a && !b) return "Salary on request";
  const range = a && b && a !== b ? `${a} – ${b}` : (a || b)!;
  return `${range} ${PERIOD[period] ?? ""}`.trim();
}

export function tuitionText(amount: string | null, currency: string, period: string) {
  const a = money(amount, currency);
  return a ? `${a} ${PERIOD[period] ?? ""}`.trim() : "Tuition on request";
}

export const date = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

// The application journey. Getting offer and Visa processing come straight after Processing.
export const STAGES = ["SUBMITTED", "ELIGIBILITY_REVIEW", "INITIAL_PAYMENT", "DOCUMENT_SIGNING", "PROCESSING", "GETTING_OFFER", "VISA_PROCESSING", "FINAL_COLLECTION", "COMPLETED"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted", ELIGIBILITY_REVIEW: "Eligibility review", INITIAL_PAYMENT: "Initial invoice and payment",
  DOCUMENT_SIGNING: "Contract signing", PROCESSING: "Processing", GETTING_OFFER: "Getting offer", VISA_PROCESSING: "Visa processing",
  FINAL_COLLECTION: "Final collection", COMPLETED: "Completed",
};
export const SERVICE_LABEL: Record<string, string> = { WORK: "Work Abroad", STUDY: "Study Abroad", VISA: "Visa Processing", FLIGHT: "Flights" };

/** Appointment times are agreed in Kigali time, whatever the server's time zone. */
export const kigaliTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Africa/Kigali", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (Kigali time)";
