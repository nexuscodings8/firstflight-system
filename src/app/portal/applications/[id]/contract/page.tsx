import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { factsFor } from "@/lib/progress";
import { currentTemplate } from "@/lib/settings";
import { renderContract } from "@/lib/contracts";
import { SignForm } from "@/components/sign-form";

export const metadata = { title: "Sign your contract" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["CLIENT"], `/portal/applications/${id}/contract`);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, id), eq(s.applications.clientId, user.id)), with: { client: { columns: { name: true, email: true, phone: true } } } });
  if (!app) notFound();
  const f = await factsFor(db, app.id);
  const t = await currentTemplate(app.service);
  const back = <Link href={`/portal/applications/${app.id}`} className="mb-4 inline-flex text-sm font-semibold text-brand underline">← Back to {app.reference}</Link>;
  if (f.contractSigned || !f.firstPaid || f.status !== "ACTIVE") return (
    <>{back}<div className="card p-6"><h1 className="text-2xl">Service contract</h1><p className="mt-2" role={f.contractSigned ? "status" : undefined}>{f.contractSigned ? "Your contract is signed. A copy is saved with your application, where you can download it." : f.status !== "ACTIVE" ? "This application is closed." : "Your contract unlocks once Finance approves your first instalment."}</p>{f.contractSigned && <Link href={`/portal/applications/${app.id}#contract`} className="btn-primary btn-sm mt-3">Back to my application</Link>}</div></>
  );
  return (
    <>
      {back}
      <div className="card p-6 sm:p-8">
        <p className="text-sm muted">{app.reference} · version {t.version}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl">{t.title}</h1>
        <div className="mt-4 max-h-[60vh] overflow-y-auto whitespace-pre-line rounded-xl border border-line bg-mist/40 p-4 text-sm leading-relaxed" tabIndex={0} aria-label="Contract text">{renderContract(t.body, app)}</div>
        <div className="mt-6"><SignForm applicationId={app.id} templateId={t.id} clientName={app.client.name} /></div>
        <p className="mt-4 text-sm muted">Prefer to sign on paper? Ask your consultant for an office appointment.</p>
      </div>
    </>
  );
}
