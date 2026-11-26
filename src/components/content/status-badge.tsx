export const STATUS_STYLE: Record<string, [string, string]> = {
  DRAFT: ["Draft", "bg-slate-100 text-slate-700"], PUBLISHED: ["Published", "bg-emerald-50 text-emerald-700"], ARCHIVED: ["Archived", "bg-slate-200 text-slate-500"],
};
export function StatusBadge({ status }: { status: string }) {
  const [t, c] = STATUS_STYLE[status] ?? [status, "bg-slate-100"];
  return <span className={`badge ${c}`}>{t}</span>;
}
