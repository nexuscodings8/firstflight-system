import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canUploadToApplication, canViewApplication } from "@/lib/permissions";
import { loadApplication, stepFacts } from "@/lib/applications";
import { ApplicationView } from "@/components/application-view";
import { InvoicesPanel } from "@/components/invoices-panel";
import { paidStub } from "@/components/paid-stub";
import { nextStep } from "@/lib/next-step";
import { RequestsPanel } from "@/components/requests-panel";
import { refundInfo } from "@/lib/refund-info";
import { ContractPanel } from "@/components/contract-panel";
import { AppointmentsPanel } from "@/components/appointments-panel";
import { OfferPanel } from "@/components/offer-panel";

export default async function ClientApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; existing?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(["CLIENT"], `/portal/applications/${id}`);
  const app = await loadApplication(id);
  // Not found and not yours look the same, so references can't be probed.
  if (!app || !canViewApplication(user, app)) notFound();
  return (
    <>
      <Link href="/portal/applications" className="mb-4 inline-flex text-sm font-semibold text-brand underline">← My applications</Link>
      {sp.submitted && <p role="status" className="mb-4 rounded-2xl bg-emerald-50 p-4 font-medium text-emerald-800">Application {app.reference} submitted. Upload your documents below; a consultant will be assigned shortly.</p>}
      {sp.existing && <p role="status" className="mb-4 rounded-2xl bg-gold/15 p-4 font-medium">You already have an application in progress, so we opened it for you. You can have one active application at a time.</p>}
      <ApplicationView app={app} mode="client" canUpload={canUploadToApplication(user, app)} stub={paidStub(app)} nextStep={nextStep({ ...app, ...stepFacts(app) }, "client")}>
        <OfferPanel app={app} mode="client" />
        <AppointmentsPanel app={app} mode="client" />
        <InvoicesPanel app={app} mode="client" />
        <ContractPanel app={app} mode="client" />
        <RequestsPanel app={app} mode="client" refund={await refundInfo(app)} />
      </ApplicationView>
    </>
  );
}
