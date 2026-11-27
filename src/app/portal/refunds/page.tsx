import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps } from "@/lib/client-data";
import { date, money } from "@/lib/format";
import { KIND_LABEL, OPEN_STATES, STATE_BADGE } from "@/lib/refunds";
import { Empty } from "@/components/cards";
import { RefundTrack } from "@/components/refund-track";

export const metadata = { title: "Refund requests" };

export default async function Refunds() {
  const user = await requireUser(["CLIENT"], "/portal/refunds");
  const apps = await clientApps(user.id);
  const rows = apps.flatMap((a) => a.refunds.map((r) => ({ r, a })));
  const canAsk = apps.filter((a) => a.invoices.some((i) => i.payments.length) && !a.refunds.some((r) => OPEN_STATES.includes(r.state)));
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[clamp(26px,3vw,36px)]">Refund requests</h1>
        <p className="mt-1 max-w-2xl muted">Every request is reviewed by your consultant, then Finance, then an administrator. You can follow each step here. You can also ask to reapply instead of a refund, keeping what you have paid.</p>
        <a className="mt-2 inline-block text-sm font-semibold text-brand underline" href="/forms/refund">Download the paper refund form (PDF)</a>
      </div>
      <ul className="grid gap-3">
        {rows.map(({ r, a }) => (
          <li key={r.id} className="card p-5" data-testid="refund-row">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{KIND_LABEL[r.kind]} {r.reference} · <Link className="text-brand underline" href={`/portal/applications/${a.id}`}>{a.reference}</Link>{r.invoice ? ` · ${r.invoice.number}` : ""}</p>
                <p className="text-sm muted">Submitted {date(r.createdAt)}{r.amountRequested ? ` · ${money(r.amountRequested, r.currency ?? "USD")} asked` : ""}{r.paidAmount ? ` · ${money(r.paidAmount, r.currency ?? "USD")} paid ${date(r.paidAt)}, reference ${r.paidReference}` : ""}</p></div>
              <span className={`badge ${STATE_BADGE[r.state]?.[1] ?? "bg-mist"}`}>{STATE_BADGE[r.state]?.[0] ?? r.state}</span>
            </div>
            <RefundTrack r={r} />
            {r.adminNote && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Decision:</span> {r.adminNote}</p>}
            {r.kind === "REAPPLICATION" && r.state === "COMPLETED" && r.reapplyMode === "NEW" && <Link href="/" className="btn-primary btn-sm mt-3">Start your new application</Link>}
          </li>
        ))}
      </ul>
      {!rows.length && <Empty title="No refund requests" />}
      {canAsk.length > 0 && <p className="text-sm muted">To make a request, open the application and choose <strong>Request a refund or reapply</strong>: {canAsk.map((a, i) => <span key={a.id}>{i ? ", " : ""}<Link className="font-semibold text-brand underline" href={`/portal/applications/${a.id}#refund-form`}>{a.reference}</Link></span>)}.</p>}
    </div>
  );
}
