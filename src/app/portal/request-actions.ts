"use server";
// Client requests on their own application: refunds (step 1 request, step 2 form) and service amendments.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { createRefundRequest } from "@/lib/refund-create";
import { isErr, storeUpload } from "@/lib/upload";

export type ReqState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);
import { AMENDMENT_KINDS } from "@/lib/requests";

async function ownApp(fd: FormData) {
  const user = await requireUser(["CLIENT"]);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, str(fd, "applicationId", 64)), eq(s.applications.clientId, user.id)) });
  return { user, app };
}

/** The client's online refund or reapplication form (eligibility, amount and one-open-request rules are in createRefundRequest). */
export async function submitRefund(_: ReqState, fd: FormData): Promise<ReqState> {
  const { user, app } = await ownApp(fd);
  if (!app) return { error: "Application not found." };
  const file = await storeUpload(fd.get("supporting"), { required: false, label: "the supporting document", imagesAndPdfOnly: true });
  if (isErr(file)) return { error: file.error };
  const res = await createRefundRequest({ appId: app.id, fd, actor: user, source: "ONLINE", file });
  revalidatePath(`/portal/applications/${app.id}`); revalidatePath("/portal/refunds");
  return res;
}

/** A client asks to change something about their application. */
export async function requestAmendment(_: ReqState, fd: FormData): Promise<ReqState> {
  const { user, app } = await ownApp(fd);
  if (!app) return { error: "Application not found." };
  if (app.status !== "ACTIVE") return { error: "This application is closed. Send an enquiry instead." };
  const kind = str(fd, "kind", 20);
  const details = str(fd, "details");
  if (!(kind in AMENDMENT_KINDS)) return { error: "Choose what you want to change." };
  if (details.length < 10) return { error: "Describe the change you need." };
  await db.transaction(async (tx) => {
    const [a] = await tx.insert(s.amendmentRequests).values({ applicationId: app.id, clientId: user.id, kind, details }).returning();
    await logActivity(tx, { actorId: user.id, action: "amendment.requested", entityType: "amendment", entityId: a.id, applicationId: app.id, summary: `${user.name} asked to change ${app.reference}: ${AMENDMENT_KINDS[kind as keyof typeof AMENDMENT_KINDS].toLowerCase()}` });
    await notify(tx, app.consultantId ? { userId: app.consultantId, title: "Change requested", body: `${app.reference}: ${details.slice(0, 120)}`, link: `/staff/applications/${app.id}` } : { role: "ADMIN", title: "Change requested", body: `${app.reference}: ${details.slice(0, 120)}`, link: `/staff/applications/${app.id}` });
  });
  revalidatePath(`/portal/applications/${app.id}`);
  return { ok: "Change request sent to your consultant." };
}
