"use server";
// Contract signing (client, online) and upload of a paper contract signed at the office (assigned consultant
// or admin). Both need Finance's approval of the first instalment, checked on the server inside the transaction.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { factsFor, autoAdvance } from "@/lib/progress";
import { currentTemplate } from "@/lib/settings";
import { renderContract, sameName, signedContractPdf } from "@/lib/contracts";
import { saveBytes } from "@/lib/storage";
import { isErr, storeUpload } from "@/lib/upload";
import { nextRef } from "@/lib/refs";
import { emailUser } from "@/lib/email";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 200) => String(fd.get(k) ?? "").trim().slice(0, n);
const refresh = (id: string) => { revalidatePath(`/portal/applications/${id}`); revalidatePath(`/portal/applications/${id}/contract`); revalidatePath(`/staff/applications/${id}`); };

async function readyToSign(appId: string): Promise<string | null> {
  const f = await factsFor(db, appId);
  if (f.status !== "ACTIVE") return "This application is closed.";
  if (!f.firstPaid) return "Your contract unlocks once Finance approves your first instalment.";
  if (f.contractSigned) return "The contract for this application is already signed.";
  return null;
}

export async function signContract(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)), with: { client: { columns: { name: true, email: true, phone: true } } } });
  if (!app || app.clientId !== user.id) return { error: "Application not found." };
  const name = str(fd, "signedName", 120);
  if (fd.get("agree") !== "on") return { error: "Tick the box to confirm you have read and accept the contract." };
  if (!sameName(name, app.client.name)) return { error: `Type your full name exactly as on your account (${app.client.name}).` };
  const templateId = str(fd, "templateId", 64);
  const t = await currentTemplate(app.service);
  if (t.id !== templateId) return { error: "The contract wording was updated while you were reading. Please read the new version and sign again." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = (h.get("user-agent") ?? "").slice(0, 300) || null;
  const now = new Date();
  const body = renderContract(t.body, app, now);
  const result = await db.transaction(async (tx) => {
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
    const f = await factsFor(tx, app.id);
    if (f.status !== "ACTIVE") return { error: "This application is closed." };
    if (!f.firstPaid) return { error: "Your contract unlocks once Finance approves your first instalment." };
    if (f.contractSigned) return { error: "The contract for this application is already signed." };
    const number = await nextRef(tx, "CT");
    const key = await saveBytes(await signedContractPdf({ title: t.title, number, body, signedName: name, signedAt: now, ip, version: t.version }), "application/pdf");
    const [c] = await tx.insert(s.contracts).values({ applicationId: app.id, kind: "CONTRACT", method: "ONLINE", templateId: t.id, version: t.version, title: t.title, body, signedName: name, signedAt: now, signedById: user.id, signedIp: ip, signedUserAgent: ua, storageKey: key, fileName: `${number}.pdf`, mimeType: "application/pdf" }).returning({ id: s.contracts.id });
    await logActivity(tx, { actorId: user.id, action: "contract.signed", entityType: "contract", entityId: c.id, applicationId: app.id, summary: `${user.name} signed the service contract online (${number}, version ${t.version}) for ${app.reference}` });
    if (app.consultantId) await notify(tx, { userId: app.consultantId, title: "Contract signed", body: `${app.client.name} signed the contract for ${app.reference}.`, link: `/staff/applications/${app.id}` });
    await notify(tx, { role: "ADMIN", title: "Contract signed", body: `${app.reference}: signed online by ${app.client.name}.`, link: `/staff/applications/${app.id}` });
    await autoAdvance(tx, app.id, user.id);
    return { ok: "Contract signed. A copy is saved in your application and your file has moved to processing." };
  });
  if (result.ok) await emailUser(user.id, `Your signed contract for ${app.reference}`, `Thank you. Your service contract for ${app.reference} is signed. You can download a copy from your client portal at any time.`, `/portal/applications/${app.id}`);
  refresh(app.id);
  return result;
}

/** A consultant or admin uploads the scan of a contract the client signed on paper at the office. */
export async function uploadSignedContract(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["ADMIN", "CONSULTANT"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || !canWorkOnCase(user, app)) return { error: "You can't work on this application." };
  const why = await readyToSign(app.id);
  if (why) return { error: why.replace("Your contract unlocks", "The contract unlocks").replace("your first", "the client's first") };
  const signedOn = str(fd, "signedOn", 10);
  const signedAt = /^\d{4}-\d{2}-\d{2}$/.test(signedOn) ? new Date(`${signedOn}T12:00:00Z`) : null;
  if (!signedAt || +signedAt > Date.now() + 86_400_000) return { error: "Enter the date the client signed." };
  if (fd.get("confirm") !== "on") return { error: "Confirm the client signed this copy in person." };
  const file = await storeUpload(fd.get("file"), { required: true, label: "the signed contract scan", imagesAndPdfOnly: true });
  if (isErr(file) || !file) return { error: isErr(file) ? file.error : "Attach the signed contract scan." };
  const t = await currentTemplate(app.service);
  const result = await db.transaction(async (tx) => {
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
    const [dup] = await tx.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.applicationId, app.id), eq(s.contracts.kind, "CONTRACT"))).limit(1);
    if (dup) return { error: "The contract for this application is already signed." };
    const [c] = await tx.insert(s.contracts).values({ applicationId: app.id, kind: "CONTRACT", method: "UPLOADED", templateId: t.id, version: t.version, title: t.title, signedAt, storageKey: file.key, fileName: file.name, mimeType: file.mime, uploadedById: user.id }).returning({ id: s.contracts.id });
    await logActivity(tx, { actorId: user.id, action: "contract.uploaded", entityType: "contract", entityId: c.id, applicationId: app.id, summary: `${user.name} uploaded the paper contract signed on ${signedOn} for ${app.reference}` });
    await notify(tx, { userId: app.clientId, title: "Signed contract received", body: `${app.reference}: your signed contract is now on file.`, link: `/portal/applications/${app.id}` });
    await autoAdvance(tx, app.id, user.id);
    return { ok: "Signed contract uploaded. The application moves to processing." };
  });
  refresh(app.id);
  return result;
}
