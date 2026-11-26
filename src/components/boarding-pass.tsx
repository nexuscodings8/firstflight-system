import Link from "next/link";
import { STAGE_LABEL, SERVICE_LABEL, date, label } from "@/lib/format";

type Pass = {
  id: string; reference: string; service: "WORK" | "STUDY" | "VISA"; stage: string; status: string; createdAt: Date;
  selection: unknown; client: { name: string }; consultant?: { name: string } | null;
};

/** The application as a boarding pass: who, what, where, the reference, and a stub with status and payments. */
export function BoardingPass({ app, href, stub, headingLevel = "p" }: { app: Pass; href?: string; stub?: React.ReactNode; headingLevel?: "p" | "h1" }) {
  const sel = app.selection as { title: string; details?: [string, string][] };
  const dest = sel.details?.find(([k]) => /destination|country/i.test(k))?.[1] ?? sel.details?.[0]?.[1] ?? "—";
  const Ref = headingLevel;
  const body = (
    <>
      <div className="border-b-2 border-dashed border-line p-5 sm:p-6 lg:border-b-0 lg:border-r-2">
        <dl className="grid gap-x-4 gap-y-2.5 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]">
          <div><dt className="text-sm muted">Passenger</dt><dd className="font-semibold">{app.client.name}</dd></div>
          <div><dt className="text-sm muted">Service</dt><dd className="font-semibold">{SERVICE_LABEL[app.service]}</dd></div>
          <div><dt className="text-sm muted">From</dt><dd className="font-semibold">Kigali</dd></div>
          <div><dt className="text-sm muted">To</dt><dd className="font-semibold">{dest}</dd></div>
        </dl>
        <Ref className="mt-3.5 mb-1 font-display text-[clamp(24px,3.4vw,34px)] font-extrabold leading-tight text-brand [overflow-wrap:anywhere]">{app.reference}</Ref>
        <p className="text-sm muted">{sel.title}</p>
      </div>
      <div className="flex flex-col items-start gap-1.5 bg-brand/[.05] p-5 text-sm">
        <span className="badge bg-brand/10 text-brand">{app.status === "ACTIVE" ? STAGE_LABEL[app.stage] : label(app.status)}</span>
        {stub}
        <span className="muted">Opened {date(app.createdAt)}{app.consultant !== undefined ? ` · Consultant: ${app.consultant?.name ?? "being assigned"}` : ""}</span>
      </div>
    </>
  );
  const cls = "grid overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_1px_2px_rgba(15,35,80,.05),0_6px_18px_rgba(15,35,80,.06)] lg:grid-cols-[minmax(0,1fr)_260px]";
  return href ? <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(4,66,159,.14)]`}>{body}</Link> : <article className={cls}>{body}</article>;
}

/** "Paid X of Y" with a bar, for the boarding-pass stub. */
export function PaidBar({ paid, total, text }: { paid: number; total: number; text: string }) {
  return (
    <>
      <span className="muted">Paid</span>
      <b>{text}</b>
      <span className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#04429f,#2f72d8)]" style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} /></span>
    </>
  );
}
