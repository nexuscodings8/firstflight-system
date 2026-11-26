import { STAGES, STAGE_LABEL } from "@/lib/format";

/** FIRST FLIGHT's little plane, from the brand demo; marks the current step. */
export function PlaneArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-35 -45 255 95" aria-hidden="true" className={className}>
      <path d="M-2 -2 L-28 -40 L-4 -40 L34 -6Z" fill="#f7bf29" />
      <path d="M0 0 Q0 -14 18 -14 L170 -14 Q200 -12 214 2 Q200 14 170 14 L18 14 Q0 14 0 0Z" fill="#04429f" />
      <path d="M2 1 L212 1 Q210 5 207 6 L4 6 Q2 4 2 1Z" fill="#f7bf29" />
      <path d="M92 4 L60 44 L86 44 L140 4Z" fill="#2f72d8" />
      <ellipse cx="98" cy="20" rx="17" ry="6.5" fill="#f7bf29" />
      <g fill="#f7bf29">{[40, 54, 68, 82, 96, 110, 124, 138, 152].map((x) => <circle key={x} cx={x} cy="-4" r="3" />)}<path d="M184 -9 Q199 -7 207 -1 L186 -1Z" /></g>
      <path d="M16 -3 L-6 -18 L8 -18 L38 -3Z" fill="#d9a514" />
    </svg>
  );
}

/** The application route: dots joined by a line, with the plane on the current step (vertical on phones). */
export function StageTracker({ stage, status }: { stage: string; status: string }) {
  const cur = status === "COMPLETED" ? STAGES.length : STAGES.indexOf(stage as (typeof STAGES)[number]);
  const stopped = ["NOT_ELIGIBLE", "UNSUCCESSFUL", "WITHDRAWN"].includes(status);
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-7" aria-label="Application progress">
      {STAGES.map((st, i) => {
        const done = i < cur, now = i === cur;
        const state = done ? "Completed" : now ? (stopped ? "Stopped" : "In progress") : "Upcoming";
        return (
          <li key={st} className="relative pb-[18px] pl-11 text-left text-sm leading-snug sm:px-1.5 sm:pb-0 sm:pt-9 sm:text-center" aria-current={now ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className={`absolute left-[9px] -top-1/2 bottom-1/2 w-1 sm:-left-1/2 sm:right-1/2 sm:top-[13px] sm:bottom-auto sm:h-1 sm:w-auto ${done || now ? "bg-brand" : "bg-line"}`} />}
            {now
              ? <PlaneArt className={`absolute -left-2.5 top-1 h-[17px] w-11 sm:left-1/2 sm:top-px sm:h-6 sm:w-[62px] sm:-translate-x-[46%] ${stopped ? "grayscale" : ""}`} />
              : <span aria-hidden="true" className={`absolute left-0 top-0.5 z-[1] size-[22px] rounded-full border-4 sm:left-1/2 sm:top-1 sm:-translate-x-1/2 ${done ? "border-brand bg-brand" : "border-line bg-white"}`} />}
            <b className="block font-semibold">{STAGE_LABEL[st]}</b>
            <span className={`block text-[13px] ${now ? (stopped ? "font-semibold text-red-700" : "font-semibold text-brand") : "muted"}`}>{state}</span>
          </li>
        );
      })}
    </ol>
  );
}
