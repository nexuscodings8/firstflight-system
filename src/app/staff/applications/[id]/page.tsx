import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canManageFinance, canUploadToApplication, canViewApplication, canWorkOnCase } from "@/lib/permissions";
import { loadApplication } from "@/lib/applications";
import { dateTime } from "@/lib/format";
import { ApplicationView } from "@/components/application-view";
import { InvoicesPanel } from "@/components/invoices-panel";
import { paidStub } from "@/components/paid-stub";
import { clearance } from "@/components/clearance-badge";
import { nextStep } from "@/lib/next-step";
import { nowMs } from "@/lib/finance";
import { RequestsPanel } from "@/components/requests-panel";
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
  const history = await db.query.activities.findMany({ where: eq(s.activities.applicationId, app.id), orderBy: [desc(s.activities.createdAt)], limit: 40, with: { actor: { columns: { name: true } } } });
  return (
    <>
      <Link href="/staff/applications" className="mb-4 inline-flex text-sm font-semibold text-brand underline">← Back to list</Link>
      <p className="mb-4 text-sm muted">Client: <strong className="text-ink">{app.client.name}</strong> · {app.client.email}{app.client.phone ? ` · ${app.client.phone}` : ""}</p>
      {!work && user.role === "CONSULTANT" && <p className="mb-4 rounded-2xl bg-gold/15 p-4 text-sm">You can view this application, but only its assigned consultant can change it.</p>}
      <ApplicationView
        app={app} mode="staff" canUpload={canUploadToApplication(user, app)}
        stub={finance ? paidStub(app) : (() => { const [t, c] = clearance(app.invoices, nowMs()); return <><span className="muted">Payment clearance</span><span className={`badge ${c}`}>{t}</span></>; })()}
        nextStep={nextStep(app, "staff")}
        itemTools={work ? (c) => (c.documents.length > 0 && (c.state === "UPLOADED" || c.state === "REJECTED") ? <ReviewControls applicationId={app.id} itemId={c.id} label={c.label} /> : null) : undefined}
        checklistFooter={work && app.status === "ACTIVE" ? <details className="mt-4 rounded-xl bg-mist p-4"><summary className="cursor-pointer font-semibold text-brand">Request another document</summary><div className="mt-3"><RequestDocumentForm applicationId={app.id} /></div></details> : undefined}
        updatesFooter={work ? <div className="mt-5 border-t border-line pt-4"><h3 className="mb-2 text-base">Post an update or note</h3><UpdateForm applicationId={app.id} /></div> : undefined}
      >
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <InvoicesPanel app={app} mode={finance ? "finance" : "summary"} rules={rules} />
          {work && <section className="card p-6"><h2 className="mb-3 text-xl">Progress</h2><ProgressForm applicationId={app.id} stage={app.stage} status={app.status} /></section>}
        </div>
        <RequestsPanel app={app} mode="staff" canDecide={work} seeRefunds={finance} />
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
