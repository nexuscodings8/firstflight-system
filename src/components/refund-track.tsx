import { trackOf } from "@/lib/refunds";

/** Step-by-step tracker for a refund or reapplication request. */
export function RefundTrack({ r }: { r: { kind: string; state: string } }) {
  const steps = trackOf(r);
  return (
    <ol className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="Request progress">
      {steps.map((x) => (
        <li key={x.step} aria-current={x.current ? "step" : undefined} className={`rounded-full px-2.5 py-1 font-semibold ${x.done ? "bg-emerald-100 text-emerald-800" : x.current ? "bg-brand text-white" : "bg-mist muted"}`}>
          {x.done ? "✓ " : ""}{x.label}
        </li>
      ))}
      {r.state === "REJECTED" && <li className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-800">Rejected</li>}
    </ol>
  );
}
