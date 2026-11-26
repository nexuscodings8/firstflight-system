import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { REFUND_STATUS } from "@/lib/requests";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { decideRefund, payRefund } from "../refund-actions";

export const metadata = { title: "Refunds" };
const TABS = { open: ["REQUESTED", "FORM_OPEN", "FORM_SUBMITTED"], done: ["PAID", "DECLINED"] } as const;

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser(["FINANCE", "ADMIN"], "/staff/finance/refunds");
  const show = (await searchParams).show === "done" ? "done" : "open";
  const rows = await db.query.refundRequests.findMany({
    where: inArray(s.refundRequests.status, [...TABS[show]]), orderBy: [desc(s.refundRequests.createdAt)], limit: 200,
    with: { application: { columns: { id: true, reference: true } }, client: { columns: { name: true, email: true, phone: true } }, invoice: { columns: { number: true, description: true, amount: true, currency: true } } },
  });
  return (
    <div className="grid gap-5">
      <Link href="/staff/finance" className="text-sm font-semibold text-brand">← Finance</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl">Refunds</h1><p className="mt-1 max-w-2xl text-sm muted">1. The client asks. 2. You approve (the refund form opens for them) or decline. 3. The client fills in the form. 4. You pay and record the transfer reference.</p></div>
        <nav aria-label="Filter refunds" className="flex gap-1 text-sm">{(["open", "done"] as const).map((k) => <Link key={k} href={`/staff/finance/refunds?show=${k}`} aria-current={show === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${show === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{k === "open" ? "Open" : "Paid or declined"}</Link>)}</nav>
      </div>
      {rows.map((r) => (
        <article key={r.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{r.reference} · {r.client.name}</p><p className="text-sm muted"><Link className="text-brand underline" href={`/staff/applications/${r.application.id}`}>{r.application.reference}</Link>{r.invoice ? ` · ${r.invoice.number}: ${r.invoice.description} (${money(r.invoice.amount, r.invoice.currency)})` : ""} · asked {date(r.createdAt)}</p></div>
            <span className={`badge ${REFUND_STATUS[r.status][1]}`}>{REFUND_STATUS[r.status][0]}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm"><span className="font-semibold">Reason:</span> {r.reason}</p>
          {r.formSubmittedAt && (
            <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-mist p-3 text-sm sm:grid-cols-2">
              <div><dt className="inline muted">Amount requested: </dt><dd className="inline font-semibold">{money(r.amountRequested, r.currency ?? "USD")}</dd></div>
              <div><dt className="inline muted">Pay by: </dt><dd className="inline font-semibold">{r.payoutMethod ? PAYMENT_METHOD_LABEL[r.payoutMethod] : ""}</dd></div>
              <div><dt className="inline muted">Account name: </dt><dd className="inline font-semibold">{r.accountName}</dd></div>
              <div><dt className="inline muted">Account: </dt><dd className="inline font-semibold">{r.accountDetails}</dd></div>
            </dl>
          )}
          {r.decisionNote && <p className="mt-2 text-sm"><span className="muted">Note to client:</span> {r.decisionNote}</p>}
          {r.status === "PAID" && <p className="mt-2 text-sm font-semibold text-emerald-700">Paid {money(r.paidAmount, r.currency ?? "USD")} on {date(r.paidAt)}, reference {r.paidReference}.</p>}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {r.status === "REQUESTED" && (
              <ActionForm action={decideRefund} submit="Approve and open the refund form" className="grid gap-2">
                <input type="hidden" name="refundId" value={r.id} /><input type="hidden" name="decision" value="approve" />
                <label className="sr-only" htmlFor={`ap-${r.id}`}>Note to the client (optional)</label><input id={`ap-${r.id}`} name="note" className="input text-sm" placeholder="Note to the client (optional)" />
              </ActionForm>
            )}
            {r.status === "FORM_SUBMITTED" && (
              <ActionForm action={payRefund} submit="Record refund as paid" className="grid gap-2 sm:grid-cols-3">
                <input type="hidden" name="refundId" value={r.id} />
                <div><label className="label" htmlFor={`pa-${r.id}`}>Amount paid</label><input id={`pa-${r.id}`} name="amount" defaultValue={Number(r.amountRequested ?? 0)} inputMode="decimal" className="input" required /></div>
                <div><label className="label" htmlFor={`pr-${r.id}`}>Transfer reference</label><input id={`pr-${r.id}`} name="reference" className="input" required maxLength={80} /></div>
                <div><label className="label" htmlFor={`pd-${r.id}`}>Date paid</label><input id={`pd-${r.id}`} name="paidAt" type="date" className="input" /></div>
              </ActionForm>
            )}
            {(r.status === "REQUESTED" || r.status === "FORM_SUBMITTED") && (
              <ActionForm action={decideRefund} submit="Decline refund" className="grid gap-2" buttonClass="btn-ghost btn-sm justify-self-start">
                <input type="hidden" name="refundId" value={r.id} /><input type="hidden" name="decision" value="decline" />
                <label className="sr-only" htmlFor={`dc-${r.id}`}>Reason for declining</label><input id={`dc-${r.id}`} name="note" className="input text-sm" placeholder="Reason (shown to the client)" />
              </ActionForm>
            )}
            {r.status === "FORM_OPEN" && <p className="text-sm muted">Waiting for the client to fill in the refund form.</p>}
          </div>
        </article>
      ))}
      {!rows.length && <Empty title={show === "open" ? "No open refund requests" : "No refunds yet"} />}
    </div>
  );
}
