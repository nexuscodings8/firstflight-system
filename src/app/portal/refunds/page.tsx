import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps } from "@/lib/client-data";
import { date, money } from "@/lib/format";
import { REFUND_STATUS } from "@/lib/requests";
import { Empty } from "@/components/cards";

export const metadata = { title: "Refund requests" };

export default async function Refunds() {
  const user = await requireUser(["CLIENT"], "/portal/refunds");
  const apps = await clientApps(user.id);
  const rows = apps.flatMap((a) => a.refunds.map((r) => ({ r, a })));
  const canAsk = apps.filter((a) => a.invoices.some((i) => i.payments.length));
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Refund requests</h1><p className="mt-1 max-w-2xl muted">Refunds take two steps: you ask, Finance reviews the request, and if it&apos;s approved you fill in a short refund form with how to pay you.</p></div>
      <ul className="grid gap-3">
        {rows.map(({ r, a }) => (
          <li key={r.id} className={`card p-5 ${r.status === "FORM_OPEN" ? "border-2 border-brand/40" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{r.reference} · <Link className="text-brand underline" href={`/portal/applications/${a.id}`}>{a.reference}</Link>{r.invoice ? ` · ${r.invoice.number}` : ""}</p><p className="text-sm muted">Asked {date(r.createdAt)}{r.paidAmount ? ` · ${money(r.paidAmount, r.currency ?? "USD")} paid ${date(r.paidAt)}` : ""}</p></div>
              <span className={`badge ${REFUND_STATUS[r.status][1]}`}>{REFUND_STATUS[r.status][0]}</span>
            </div>
            {r.decisionNote && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Finance:</span> {r.decisionNote}</p>}
            {r.status === "FORM_OPEN" && <Link href={`/portal/applications/${a.id}#rq-h`} className="btn-primary btn-sm mt-3">Fill in the refund form</Link>}
          </li>
        ))}
      </ul>
      {!rows.length && <Empty title="No refund requests" />}
      {canAsk.length > 0 && <p className="text-sm muted">To ask for a refund, open the application and choose <strong>Request a refund</strong>: {canAsk.map((a, i) => <span key={a.id}>{i ? ", " : ""}<Link className="font-semibold text-brand underline" href={`/portal/applications/${a.id}#rq-h`}>{a.reference}</Link></span>)}.</p>}
    </div>
  );
}
