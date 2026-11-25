import { STAGES, STAGE_LABEL } from "@/lib/format";

export function StageTracker({ stage, status }: { stage: string; status: string }) {
  const cur = status === "COMPLETED" ? STAGES.length : STAGES.indexOf(stage as (typeof STAGES)[number]);
  const stopped = ["NOT_ELIGIBLE", "UNSUCCESSFUL", "WITHDRAWN"].includes(status);
  return (
    <ol className="grid gap-3 sm:grid-cols-7 sm:gap-0" aria-label="Application progress">
      {STAGES.map((st, i) => {
        const done = i < cur, now = i === cur;
        return (
          <li key={st} className="relative flex items-center gap-3 sm:flex-col sm:text-center">
            {i > 0 && <span aria-hidden="true" className={`absolute top-4 right-1/2 hidden h-1 w-full sm:block ${done || now ? "bg-brand" : "bg-line"}`} />}
            <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-4 text-xs font-bold ${done ? "border-brand bg-brand text-white" : now ? (stopped ? "border-red-500 bg-white text-red-600" : "border-gold bg-gold text-ink") : "border-line bg-white text-muted"}`}>{done ? "✓" : i + 1}</span>
            <span className="text-sm sm:mt-2"><span className="font-semibold">{STAGE_LABEL[st]}</span><span className="block text-xs muted">{done ? "Done" : now ? (stopped ? "Stopped" : "Current step") : "Upcoming"}</span></span>
          </li>
        );
      })}
    </ol>
  );
}
