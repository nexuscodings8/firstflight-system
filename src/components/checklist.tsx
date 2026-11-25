import { Icon } from "./icons";
export function Checklist({ items }: { items: { id?: string; label: string; mandatory: boolean; note?: string | null }[] }) {
  if (!items.length) return <p className="mt-3 text-sm muted">Your consultant will confirm the documents for this application.</p>;
  return (
    <ul className="mt-3 divide-y divide-line">
      {items.map((r, i) => (
        <li key={r.id ?? i} className="flex items-start gap-3 py-2.5">
          <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span className="flex-1">{r.label}{r.note && <span className="block text-sm muted">{r.note}</span>}</span>
          <span className={`badge ${r.mandatory ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{r.mandatory ? "Required" : "Optional"}</span>
        </li>
      ))}
    </ul>
  );
}
