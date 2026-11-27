import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageFinance, canUploadToApplication, canViewApplication, canWorkOnCase } from "@/lib/permissions";
import { loadApplication, stepFacts } from "@/lib/applications";
import { dateTime } from "@/lib/format";
import { ApplicationView } from "@/components/application-view";
import { InvoicesPanel } from "@/components/invoices-panel";
import { paidStub } from "@/components/paid-stub";
import { clearance } from "@/components/clearance-badge";
import { nextStep } from "@/lib/next-step";
import { nowMs } from "@/lib/finance";
import { RequestsPanel } from "@/components/requests-panel";
import { AssignmentPanel } from "@/components/assignment-panel";
import { ContractPanel } from "@/components/contract-panel";
import { AppointmentsPanel } from "@/components/appointments-panel";
import { OfferPanel } from "@/components/offer-panel";
import { HistoricalPanel } from "@/components/historical-panel";
import { getOffice } from "@/lib/settings";
import { refundInfo } from "@/lib/refund-info";
import { OPEN_STATES } from "@/lib/refunds";
import { RefundForm } from "@/components/refund-form";
import { openAppThread } from "@/app/staff/messages/actions";
import { matchingRules } from "@/lib/fees";
import { scopeOf } from "@/lib/fee-scope";
import { ProgressForm, RequestDocumentForm, ReviewControls, UpdateForm } from "@/components/case-tools";

export const metadata = { title: "Application" };

// Consultants see that finance work happened, never the amounts or references.
const FINANCIAL = /^(fee|invoice|payment|refund)\./;
const GENERIC: Record<string, string> = { fee: "set up the service fee plan", invoice: "updated an invoice", payment: "recorded a payment", refund: "updated a refund request" };

export default async function StaffApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE"], `/staff/applications/${id}`);
  const app = await loadApplication(id);
  if (!app || !canViewApplication(user, app)) notFound();
  const work = canWorkOnCase(user, app);
  const finance = canManageFinance(user);
  const rules = finance ? matchingRules(await db.select().from(s.feeRules), await scopeOf(app)) : [];
  const paper = work || finance ? await refundInfo(app) : null;
  const history = await db.query.activities.findMany({ where: eq(s.activities.applicationId, app.id), orderBy: [desc(s.activities.createdAt)], limit: 40, with: { actor: { columns: { name: true } } } });
  return (
    <>
      <Link href="/staff/applications" className="mb-4 inline-flex text-sm font-semibold text-brand underline">← Back to list</Link>
      <p className="mb-4 text-sm muted">Client: <strong className="text-ink">{app.client.name}</strong> · {app.client.email}{app.client.phone ? ` · ${app.client.phone}` : ""}</p>
      {!work && user.role === "CONSULTANT" && <p className="mb-4 rounded-2xl bg-gold/15 p-4 text-sm">You can view this application, but only its assigned consultant can change it.</p>}
      <ApplicationView
        app={app} mode="staff" canUpload={canUploadToApplication(user, app)}
        stub={finance ? paidStub(app) : (() => { const [t, c] = clearance(app.invoices, nowMs()); return <><span className="muted">Payment clearance</span><span className={`badge ${c}`}>{t}</span></>; })()}
        nextStep={nextStep({ ...app, ...stepFacts(app) }, "staff")}
        itemTools={work ? (c) => (c.documents.length > 0 && (c.state === "UPLOADED" || c.state === "REJECTED") ? <ReviewControls applicationId={app.id} itemId={c.id} label={c.label} /> : null) : undefined}
        checklistFooter={work && app.status === "ACTIVE" ? <details className="mt-4 rounded-xl bg-mist p-4"><summary className="cursor-pointer font-semibold text-brand">Request another document</summary><div className="mt-3"><RequestDocumentForm applicationId={app.id} /></div></details> : undefined}
        updatesFooter={work ? <div className="mt-5 border-t border-line pt-4"><h3 className="mb-2 text-base">Post an update or note</h3><UpdateForm applicationId={app.id} /></div> : undefined}
      >
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <InvoicesPanel app={app} mode={finance ? "finance" : "summary"} rules={rules} />
          {work && <section className="card p-6"><h2 className="mb-3 text-xl">Progress</h2><ProgressForm applicationId={app.id} stage={app.stage} status={app.status} /></section>}
        </div>
        <HistoricalPanel app={app} finance={finance || user.role === "ADMIN"} />
        <OfferPanel app={app} mode="staff" canWork={work} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ContractPanel app={app} mode="staff" canWork={work} role={user.role} seeMoney={finance || user.role === "ADMIN"} />
          {user.role !== "FINANCE" && <AppointmentsPanel app={app} mode="staff" canWork={work} office={work ? await getOffice() : undefined} />}
        </div>
        <RequestsPanel app={app} mode="staff" canDecide={work} seeRefunds={finance} />
        {(work || finance) && paper && (paper.refundOpen || paper.allowReapplication) && !app.refunds.some((r) => OPEN_STATES.includes(r.state)) && (
          <details className="card p-6">
            <summary className="cursor-pointer text-lg font-semibold text-brand">Record a paper refund or reapplication form</summary>
            <p className="mt-2 text-sm muted">{paper.elig.text} Clients can print the blank form from <a className="font-semibold text-brand underline" href="/forms/refund">/forms/refund</a>.</p>
            <div className="mt-3"><RefundForm applicationId={app.id} invoices={app.invoices} allowReapplication={paper.allowReapplication} refundOpen={paper.refundOpen} mode="paper" clientName={app.client.name} /></div>
          </details>
        )}
        <section className="card flex flex-wrap items-center justify-between gap-3 p-6" aria-labelledby="disc-h">
          <div><h2 id="disc-h" className="text-xl">Internal discussion</h2><p className="text-sm muted">Staff-only threads about this client. The client never sees them.</p></div>
          <div className="flex flex-wrap gap-2">
            <form action={openAppThread}><input type="hidden" name="applicationId" value={app.id} /><button className="btn-primary btn-sm">Open team thread</button></form>
            {(finance || user.role === "ADMIN") && <form action={openAppThread}><input type="hidden" name="applicationId" value={app.id} /><input type="hidden" name="private" value="1" /><button className="btn-ghost btn-sm">Finance-only thread</button></form>}
          </div>
        </section>
        {user.role !== "FINANCE" && <AssignmentPanel app={app} admin={user.role === "ADMIN"} />}
        <section className="card p-6">
          <h2 className="text-xl">History</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {history.map((h) => <li key={h.id} className="flex flex-wrap gap-x-3 border-b border-line pb-2"><span className="w-40 shrink-0 muted">{dateTime(h.createdAt)}</span><span className="flex-1">{finance || !FINANCIAL.test(h.action) ? h.summary : `${h.actor?.name ?? "Finance"} ${GENERIC[h.action.split(".")[0]] ?? "updated payments"}`}</span></li>)}
          </ol>
          {!history.length && <p className="mt-2 text-sm muted">No activity recorded yet.</p>}
        </section>
      </ApplicationView>
    </>
  );
}
