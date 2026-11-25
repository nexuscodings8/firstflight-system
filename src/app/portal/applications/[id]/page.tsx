import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canUploadToApplication, canViewApplication } from "@/lib/permissions";
import { loadApplication } from "@/lib/applications";
import { ApplicationView } from "@/components/application-view";

export default async function ClientApplication({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; existing?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(["CLIENT"], `/portal/applications/${id}`);
  const app = await loadApplication(id);
  // Not found and not yours look the same, so references can't be probed.
  if (!app || !canViewApplication(user, app)) notFound();
  return (
    <>
      <Link href="/portal" className="mb-4 inline-flex text-sm font-semibold text-brand">← Back to my applications</Link>
      {sp.submitted && <p role="status" className="mb-4 rounded-2xl bg-emerald-50 p-4 font-medium text-emerald-800">Application {app.reference} submitted. Upload your documents below; a consultant will be assigned shortly.</p>}
      {sp.existing && <p role="status" className="mb-4 rounded-2xl bg-gold/15 p-4 font-medium">You already have an active application for this listing, so we opened it for you.</p>}
      <ApplicationView app={app} mode="client" canUpload={canUploadToApplication(user, app)} />
    </>
  );
}
