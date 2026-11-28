import { SectionNotices } from "@/components/section-notices";
import Link from "next/link";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { date, dateTime, money } from "@/lib/format";
import { KIND_LABEL, OPEN_STATES, STATE_BADGE } from "@/lib/refunds";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { RefundTrack } from "@/components/refund-track";
import { adminDecision, completeRefund, consultantReview, financeReview, startRefundPayment } from "../finance/refund-actions";

export const metadata = { title: "Refunds and reapplications" };

// Which states each role acts on. Consultants only ever see requests on their own applications, without amounts.
const MINE: Record<string, string[]> = { CONSULTANT: ["SUBMITTED"], FINANCE: ["FINANCE_REVIEW", "APPROVED", "PROCESSING"], ADMIN: ["SUBMITTED", "ADMIN_APPROVAL"] };

export default async function Refunds({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser(["CONSULTANT", "FINANCE", "ADMIN"], "/staff/refunds");
  const show = (await searchParams).show;
  const tab = show === "open" || show === "done" ? show : "todo";
  const consultant = user.role === "CONSULTANT";
  const myApps = consultant ? (await db.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.consultantId, user.id))).map((x) => x.id) : null;
  const states = tab === "todo" ? MINE[user.role] : tab === "open" ? OPEN_STATES : ["COMPLETED", "REJECTED"];
  const where: SQL[] = [inArray(s.refundRequests.state, states)];
  if (myApps) where.push(inArray(s.refundRequests.applicationId, myApps.length ? myApps : ["-"]));
  const rows = await db.query.refundRequests.findMany({
    where: and(...where), orderBy: [desc(s.refundRequests.createdAt)], limit: 200,
    with: { application: { columns: { id: true, reference: true, consultantId: true } }, client: { columns: { name: true, email: true, phone: true } }, invoice: { columns: { number: true, description: true, amount: true, currency: true } } },
  });
  const tabs = [["todo", "Waiting for me"], ["open", "All open"], ["done", "Completed or rejected"]] as const;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(26px,3vw,36px)]">Refunds and reapplications</h1>
          <p className="mt-1 max-w-3xl text-sm muted">Submitted → consultant review → Finance review → admin approval → payment processing → completed. Consultants can&apos;t approve or pay refunds; only an administrator approves, and only Finance records the payout.</p>
        </div>
        <nav aria-label="Filter requests" className="flex gap-1 text-sm">{tabs.map(([k, l]) => <Link key={k} href={`/staff/refunds?show=${k}`} aria-current={tab === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{l}</Link>)}</nav>
      </div>
      <SectionNotices user={user} sections={["refunds", "reapplication"]} path="/staff/refunds" limit={5} />
      {rows.map((r) => {
        const cur = r.currency ?? "USD";
        const canConsult = r.state === "SUBMITTED" && (user.role === "ADMIN" || (consultant && r.application.consultantId === user.id));
        return (
          <article key={r.id} className="card p-5" data-testid="refund-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.reference} · {KIND_LABEL[r.kind]} · {r.client.name}</p>
                <p className="text-sm muted"><Link className="text-brand underline" href={`/staff/applications/${r.application.id}`}>{r.application.reference}</Link>{!consultant && r.invoice ? ` · ${r.invoice.number}: ${r.invoice.description}` : ""} · submitted {date(r.createdAt)}{r.source === "PAPER" ? " (paper form)" : " (online)"}</p>
              </div>
              <span className={`badge ${STATE_BADGE[r.state]?.[1] ?? "bg-mist"}`}>{STATE_BADGE[r.state]?.[0] ?? r.state}</span>
            </div>
            <RefundTrack r={r} />
            <p className="mt-3 whitespace-pre-line text-sm"><span className="font-semibold">Reason:</span> {r.reason}</p>
            {r.declarationName && <p className="text-sm"><span className="muted">Signed by:</span> {r.declarationName}{r.formSubmittedAt ? `, ${dateTime(r.formSubmittedAt)}` : ""}</p>}
            {r.formKey && <a className="mt-1 inline-block text-sm font-semibold text-brand underline" href={`/staff/viewer/refund/${r.id}`}>{r.source === "PAPER" ? "View the signed paper form" : "View the supporting document"}</a>}
            {!consultant && r.kind === "REFUND" && (
              <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-mist p-3 text-sm sm:grid-cols-2">
                <div><dt className="inline muted">Paid on the invoice: </dt><dd className="inline font-semibold">{money(r.amountPaid, cur) ?? "-"}</dd></div>
                <div><dt className="inline muted">Asked for: </dt><dd className="inline font-semibold">{money(r.amountRequested, cur) ?? "-"}</dd></div>
                <div><dt className="inline muted">Refund by: </dt><dd className="inline font-semibold">{r.payoutMethod ? PAYMENT_METHOD_LABEL[r.payoutMethod] : "-"}</dd></div>
                <div><dt className="inline muted">Account: </dt><dd className="inline font-semibold">{r.accountName ?? "-"} · {r.accountDetails ?? "-"}</dd></div>
                {r.paymentReference && <div><dt className="inline muted">Client&apos;s payment reference: </dt><dd className="inline font-semibold">{r.paymentReference}</dd></div>}
                {r.amountApproved && <div><dt className="inline muted">Finance recommends: </dt><dd className="inline font-semibold">{money(r.amountApproved, cur)}</dd></div>}
              </dl>
            )}
            {r.consultantNote && <p className="mt-2 text-sm"><span className="font-semibold">Consultant:</span> {r.consultantNote}</p>}
            {!consultant && r.financeNote && <p className="mt-1 text-sm"><span className="font-semibold">Finance:</span> {r.financeNote}</p>}
            {r.adminNote && <p className="mt-1 text-sm"><span className="font-semibold">Decision:</span> {r.adminNote}{r.reapplyMode ? ` (${r.reapplyMode === "CONTINUE" ? "continue the same application" : "start a new application"})` : ""}</p>}
            {r.state === "COMPLETED" && r.kind === "REFUND" && !consultant && <p className="mt-2 text-sm font-semibold text-emerald-700">Paid {money(r.paidAmount, cur)} on {date(r.paidAt)} by {r.payoutMethod ? PAYMENT_METHOD_LABEL[r.payoutMethod] : ""}, reference {r.paidReference}.</p>}

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {canConsult && (
                <ActionForm action={consultantReview} submit="Send to Finance" className="grid gap-2">
                  <input type="hidden" name="refundId" value={r.id} />
                  <fieldset className="flex gap-4 text-sm"><legend className="sr-only">Recommendation</legend>
                    <label className="flex items-center gap-1.5"><input type="radio" name="recommendation" value="support" /> I support it</label>
                    <label className="flex items-center gap-1.5"><input type="radio" name="recommendation" value="oppose" /> I don&apos;t support it</label></fieldset>
                  <label className="sr-only" htmlFor={`cn-${r.id}`}>Note</label><textarea id={`cn-${r.id}`} name="note" rows={2} className="input text-sm" placeholder="What you know about the case (for Finance and the administrator)" />
                </ActionForm>
              )}
              {r.state === "FINANCE_REVIEW" && user.role !== "CONSULTANT" && (
                <ActionForm action={financeReview} submit="Send for admin approval" className="grid gap-2">
                  <input type="hidden" name="refundId" value={r.id} />
                  {r.kind === "REFUND" && <div><label className="label" htmlFor={`fa-${r.id}`}>Amount Finance recommends ({cur})</label><input id={`fa-${r.id}`} name="amountApproved" inputMode="decimal" defaultValue={Number(r.amountRequested ?? 0)} className="input" /></div>}
                  <label className="sr-only" htmlFor={`fn-${r.id}`}>Finance note</label><textarea id={`fn-${r.id}`} name="note" rows={2} className="input text-sm" placeholder="What you checked (payments received, fees already spent)" />
                </ActionForm>
              )}
              {r.state === "ADMIN_APPROVAL" && user.role === "ADMIN" && (["approve", "reject"] as const).map((d) => (
                <ActionForm key={d} action={adminDecision} submit={d === "approve" ? "Approve" : "Reject"} className="grid gap-2" buttonClass={d === "approve" ? "btn-primary btn-sm justify-self-start" : "btn-ghost btn-sm justify-self-start"}>
                  <input type="hidden" name="refundId" value={r.id} /><input type="hidden" name="decision" value={d} />
                  {d === "approve" && r.kind === "REAPPLICATION" && (
                    <select name="reapplyMode" className="input text-sm" defaultValue="" aria-label="How the client reapplies"><option value="" disabled>How does the client reapply?</option><option value="CONTINUE">Continue the same application</option><option value="NEW">Close it and start a new application</option></select>
                  )}
                  <label className="sr-only" htmlFor={`ad-${d}-${r.id}`}>Note to the client</label><textarea id={`ad-${d}-${r.id}`} name="note" rows={2} className="input text-sm" placeholder={d === "approve" ? "Note to the client" : "Reason (shown to the client)"} />
                </ActionForm>
              ))}
              {r.state === "APPROVED" && user.role !== "CONSULTANT" && (
                <ActionForm action={startRefundPayment} submit="Start processing the payment" className="grid"><input type="hidden" name="refundId" value={r.id} /></ActionForm>
              )}
              {r.state === "PROCESSING" && user.role !== "CONSULTANT" && (
                <ActionForm action={completeRefund} submit="Record refund as paid" className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="refundId" value={r.id} />
                  <div><label className="label" htmlFor={`pa-${r.id}`}>Amount paid ({cur})</label><input id={`pa-${r.id}`} name="amount" defaultValue={Number(r.amountApproved ?? 0)} inputMode="decimal" className="input" required /></div>
                  <div><label className="label" htmlFor={`pm-${r.id}`}>Paid by</label><select id={`pm-${r.id}`} name="method" className="input" defaultValue={r.payoutMethod ?? "MOBILE_MONEY"}><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option></select></div>
                  <div><label className="label" htmlFor={`pr-${r.id}`}>Transfer reference</label><input id={`pr-${r.id}`} name="reference" className="input" required maxLength={80} /></div>
                  <div><label className="label" htmlFor={`pd-${r.id}`}>Date paid</label><input id={`pd-${r.id}`} name="paidAt" type="date" className="input" required /></div>
                </ActionForm>
              )}
            </div>
          </article>
        );
      })}
      {!rows.length && <Empty title={tab === "todo" ? "Nothing waiting for you" : "No requests here"} />}
    </div>
  );
}
