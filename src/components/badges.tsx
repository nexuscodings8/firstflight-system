const AV: Record<string, [string, string]> = {
  OPEN: ["Open", "bg-emerald-50 text-emerald-700"],
  CLOSING_SOON: ["Closing soon", "bg-amber-50 text-amber-800"],
  CLOSED: ["Closed", "bg-slate-100 text-slate-600"],
  FILLED: ["Filled", "bg-slate-100 text-slate-600"],
};
export function AvailabilityBadge({ value }: { value: string }) {
  const [t, c] = AV[value] ?? [value, "bg-slate-100 text-slate-600"];
  return <span className={`badge ${c}`}>{t}</span>;
}
export const canApply = (availability: string) => availability === "OPEN" || availability === "CLOSING_SOON";
