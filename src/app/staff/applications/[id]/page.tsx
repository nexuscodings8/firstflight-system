import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canUploadToApplication, canViewApplication } from "@/lib/permissions";
import { loadApplication } from "@/lib/applications";
import { ApplicationView } from "@/components/application-view";

export default async function StaffApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["ADMIN", "CONSULTANT", "FINANCE"], `/staff/applications/${id}`);
  const app = await loadApplication(id);
  if (!app || !canViewApplication(user, app)) notFound();
  return (
    <>
      <Link href="/staff" className="mb-4 inline-flex text-sm font-semibold text-brand">← Back to dashboard</Link>
      <p className="mb-4 text-sm muted">Client: <strong className="text-ink">{app.client.name}</strong> · {app.client.email}{app.client.phone ? ` · ${app.client.phone}` : ""}</p>
      <ApplicationView app={app} mode="staff" canUpload={canUploadToApplication(user, app)} />
    </>
  );
}
