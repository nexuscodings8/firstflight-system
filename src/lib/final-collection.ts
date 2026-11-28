// Final collection documents and visa estimates: wording shared by the client and consultant portals.
export const FINAL_CATEGORIES: Record<string, string> = {
  TRAVEL: "Travel documents", FORM: "Completed form", SCAN: "Scanned document", CONTRACT: "Employment or study contract", INSTRUCTIONS: "Instructions", OTHER: "Other",
};
export const FINAL_STATUS: Record<string, [string, string]> = {
  UPLOADED: ["Uploaded (not yet shared)", "bg-slate-100 text-slate-700"],
  AVAILABLE: ["Available to client", "bg-blue-50 text-brand"],
  VIEWED: ["Viewed by client", "bg-emerald-50 text-emerald-700"],
  CORRECTION_REQUIRED: ["Correction required", "bg-red-50 text-red-700"],
  UPDATED: ["Updated", "bg-amber-50 text-amber-800"],
};
/** "2026-12-10" + "14:30" → readable, in Kigali time (the estimate is stored as typed, not converted). */
export function estimateText(d: string, t: string | null) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day, 12));
  return `${dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}${t ? ` around ${t} (Kigali time)` : ""}`;
}
