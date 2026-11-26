/** Payment clearance for an application, with no amounts: what consultants (and lists) show. */
export function clearance(invoices: { status: string; dueDate: Date | null }[], now: number): [string, string] {
  const live = invoices.filter((i) => i.status !== "VOID");
  if (!live.length) return ["No fees yet", "bg-slate-100 text-slate-600"];
  if (live.every((i) => i.status === "PAID")) return ["Cleared", "bg-emerald-50 text-emerald-700"];
  if (live.some((i) => i.status !== "PAID" && i.dueDate && +i.dueDate < now)) return ["Overdue", "bg-red-50 text-red-700"];
  return ["Awaiting payment", "bg-amber-50 text-amber-800"];
}
