import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { balanceOf, fromCents } from "@/lib/finance";
import { date, money } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { decideLoan } from "@/app/loan-actions";

export const metadata = { title: "Loan requests" };

export default async function Loans({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser(["FINANCE", "ADMIN"], "/staff/finance/loans");
  const done = (await searchParams).show === "done";
  const rows = await db.query.loanRequests.findMany({
    where: done ? inArray(s.loanRequests.status, ["APPROVED", "REJECTED"]) : eq(s.loanRequests.status, "PENDING_REVIEW"), orderBy: [desc(s.loanRequests.createdAt)], limit: 100,
    with: { application: { columns: { id: true, reference: true } }, client: { columns: { name: true, phone: true } }, invoice: { with: { payments: true } } },
  });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[clamp(26px,3vw,36px)]">Loan requests</h1>
          <p className="mt-1 max-w-3xl text-sm muted">Only the third and final instalment of a three-instalment schedule can be paid with a loan, and only when it was allowed in the schedule. A request never counts as payment: approving it records the approved amount against the instalment and issues a receipt.</p></div>
        <nav className="flex gap-1 text-sm" aria-label="Filter">{[["", "Pending review"], ["done", "Decided"]].map(([k, l]) => <Link key={k} href={`/staff/finance/loans${k ? `?show=${k}` : ""}`} aria-current={(k === "done") === done ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${(k === "done") === done ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{l}</Link>)}</nav>
      </div>
      {rows.map((l) => {
        const due = balanceOf(l.invoice).due, cur = l.invoice.currency;
        return (
          <article key={l.id} className="card p-5" data-testid="loan-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{l.reference} · {l.client.name} · <Link className="text-brand underline" href={`/staff/applications/${l.application.id}`}>{l.application.reference}</Link></p>
                <p className="text-sm muted">{l.invoice.number}: {l.invoice.description} · requested {date(l.createdAt)} · still due {money(fromCents(due), cur)}</p></div>
              <span className={`badge ${l.status === "PENDING_REVIEW" ? "bg-amber-50 text-amber-800" : l.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{l.status === "PENDING_REVIEW" ? "Pending review" : l.status === "APPROVED" ? "Approved" : "Rejected"}</span>
            </div>
            <p className="mt-2 text-sm"><span className="font-semibold">{money(l.amountRequested, cur)} from {l.provider}.</span> {l.details}</p>
            {l.docKey && <a className="mt-1 inline-block text-sm font-semibold text-brand underline" href={`/staff/viewer/loan/${l.id}`}>View the loan document</a>}
            {l.status !== "PENDING_REVIEW" && <p className="mt-2 text-sm">{l.status === "APPROVED" ? `Approved ${money(l.approvedAmount, cur)} from ${l.approvedProvider} on ${date(l.decidedAt)}.${l.conditions ? ` Conditions: ${l.conditions}` : ""}` : `Rejected on ${date(l.decidedAt)}: ${l.decisionNote}`}{l.internalNote ? ` Internal note: ${l.internalNote}` : ""}</p>}
            {l.status === "PENDING_REVIEW" && (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <ActionForm action={decideLoan} submit="Approve loan" className="grid gap-2 rounded-xl bg-mist p-3 sm:grid-cols-2">
                  <input type="hidden" name="loanId" value={l.id} /><input type="hidden" name="decision" value="approve" />
                  <div><label className="label" htmlFor={`la-${l.id}`}>Approved amount ({cur})</label><input id={`la-${l.id}`} name="approvedAmount" inputMode="decimal" className="input" defaultValue={Math.min(Number(l.amountRequested), due / 100).toFixed(2)} /></div>
                  <div><label className="label" htmlFor={`lp-${l.id}`}>Lender or arrangement</label><input id={`lp-${l.id}`} name="approvedProvider" className="input" defaultValue={l.provider} /></div>
                  <div className="sm:col-span-2"><label className="label" htmlFor={`lc-${l.id}`}>Conditions (shown to the client)</label><input id={`lc-${l.id}`} name="conditions" className="input" maxLength={1000} /></div>
                  <div className="sm:col-span-2"><label className="label" htmlFor={`li-${l.id}`}>Internal note</label><input id={`li-${l.id}`} name="internalNote" className="input" maxLength={1000} /></div>
                  <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="verified" className="mt-1" /> I verified the loan documents with the lender.</label>
                </ActionForm>
                <ActionForm action={decideLoan} submit="Reject loan" buttonClass="btn-ghost btn-sm justify-self-start" className="grid gap-2 rounded-xl bg-mist p-3">
                  <input type="hidden" name="loanId" value={l.id} /><input type="hidden" name="decision" value="reject" />
                  <div><label className="label" htmlFor={`lr-${l.id}`}>Reason (shown to the client)</label><input id={`lr-${l.id}`} name="note" className="input" maxLength={1000} /></div>
                  <div><label className="label" htmlFor={`lri-${l.id}`}>Internal note</label><input id={`lri-${l.id}`} name="internalNote" className="input" maxLength={1000} /></div>
                </ActionForm>
              </div>
            )}
          </article>
        );
      })}
      {!rows.length && <Empty title={done ? "No decided loan requests" : "No loan requests waiting"} />}
    </div>
  );
}
