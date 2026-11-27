import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL, balanceOf, fromCents } from "@/lib/finance";
import { date, dateTime, money } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { reviewSubmission } from "../verify-actions";

export const metadata = { title: "Payments to verify" };

export default async function Verify({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser(["FINANCE", "ADMIN"], "/staff/finance/verify");
  const done = (await searchParams).show === "done";
  const rows = await db.query.paymentSubmissions.findMany({
    where: done ? inArray(s.paymentSubmissions.status, ["APPROVED", "REJECTED"]) : eq(s.paymentSubmissions.status, "PENDING"),
    orderBy: [done ? desc(s.paymentSubmissions.reviewedAt) : asc(s.paymentSubmissions.createdAt)], limit: 100,
    with: { invoice: { with: { payments: { columns: { amount: true } } } }, application: { columns: { id: true, reference: true }, with: { client: { columns: { name: true, phone: true } } } }, reviewedBy: { columns: { name: true } } },
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[clamp(26px,3vw,36px)]">Payments to verify</h1><p className="mt-1 max-w-2xl text-sm muted">Check each payment against your bank, mobile money or cash records before approving. Approving issues the receipt and unlocks the application&apos;s next stage; nothing counts as paid before that.</p></div>
        <nav aria-label="Filter" className="flex gap-1 text-sm">{[["", "Waiting"], ["done", "Reviewed"]].map(([k, t]) => <Link key={t} href={`/staff/finance/verify${k ? "?show=done" : ""}`} aria-current={done === !!k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${done === !!k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{t}</Link>)}</nav>
      </div>
      {rows.map((x) => (
        <article key={x.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{money(x.amount, x.invoice.currency)} · {x.application.client.name} · <Link className="text-brand underline" href={`/staff/applications/${x.application.id}`}>{x.application.reference}</Link></p>
              <p className="text-sm muted">{x.invoice.number}: {x.invoice.description} · balance before this {money(fromCents(balanceOf(x.invoice).due), x.invoice.currency)}</p></div>
            {x.loanFunded && <span className="badge bg-gold/30 text-ink">Loan-funded</span>}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-mist p-3 text-sm sm:grid-cols-2">
            <div><dt className="inline muted">Method: </dt><dd className="inline font-semibold">{PAYMENT_METHOD_LABEL[x.method]}</dd></div>
            <div><dt className="inline muted">Reference: </dt><dd className="inline font-semibold">{x.reference}</dd></div>
            <div><dt className="inline muted">Date paid: </dt><dd className="inline font-semibold">{date(x.paidAt)}</dd></div>
            <div><dt className="inline muted">Submitted: </dt><dd className="inline font-semibold">{dateTime(x.createdAt)}</dd></div>
            {x.loanFunded && <div className="sm:col-span-2"><dt className="inline muted">Loan provider: </dt><dd className="inline font-semibold">{x.loanProvider}</dd></div>}
            {x.clientNote && <div className="sm:col-span-2"><dt className="inline muted">Client&apos;s note: </dt><dd className="inline">{x.clientNote}</dd></div>}
          </dl>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {x.proofKey ? <Link className="font-semibold text-brand underline" href={`/staff/viewer/submission/${x.id}`}>View proof of payment</Link> : <span className="muted">No proof attached (cash)</span>}
            {x.loanDocKey && <Link className="font-semibold text-brand underline" href={`/staff/viewer/loan/${x.id}`}>View loan document</Link>}
          </p>
          {x.status === "PENDING" ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ActionForm action={reviewSubmission} submit="Approve payment" className="grid gap-2">
                <input type="hidden" name="id" value={x.id} /><input type="hidden" name="decision" value="approve" />
                {x.loanFunded && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="loanValidated" className="size-4 accent-brand" /> I validated the loan arrangement with {x.loanProvider}</label>}
                <label className="sr-only" htmlFor={`in-${x.id}`}>Internal note</label><input id={`in-${x.id}`} name="internalNote" className="input text-sm" placeholder="Internal note (Finance and Admin only)" />
              </ActionForm>
              <ActionForm action={reviewSubmission} submit="Reject payment" className="grid gap-2" buttonClass="btn-ghost btn-sm justify-self-start">
                <input type="hidden" name="id" value={x.id} /><input type="hidden" name="decision" value="reject" />
                <label className="sr-only" htmlFor={`rr-${x.id}`}>Reason</label><input id={`rr-${x.id}`} name="reason" className="input text-sm" placeholder="Reason, shown to the client (e.g. reference not found)" />
                <label className="sr-only" htmlFor={`ri-${x.id}`}>Internal note</label><input id={`ri-${x.id}`} name="internalNote" className="input text-sm" placeholder="Internal note (optional)" />
              </ActionForm>
            </div>
          ) : (
            <p className={`mt-3 text-sm font-semibold ${x.status === "APPROVED" ? "text-emerald-700" : "text-red-700"}`}>{x.status === "APPROVED" ? "Approved" : `Rejected: ${x.rejectionReason}`} by {x.reviewedBy?.name} {x.reviewedAt ? dateTime(x.reviewedAt) : ""}{x.internalNote ? ` · Internal note: ${x.internalNote}` : ""}</p>
          )}
        </article>
      ))}
      {!rows.length && <Empty title={done ? "Nothing reviewed yet" : "No payments waiting"} />}
    </div>
  );
}
