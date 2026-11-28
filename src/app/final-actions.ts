"use server";
// Visa processing estimates and Final collection: the client's office/remote choice and documents the assigned
// consultant (or an admin) shares with the client. Every change is logged and notifies the right person.
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { isErr, storeUpload } from "@/lib/upload";
import { FINAL_CATEGORIES, estimateText } from "@/lib/final-collection";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 1000) => String(fd.get(k) ?? "").trim().slice(0, n);
const refresh = (id: string) => { for (const p of [`/staff/applications/${id}`, `/portal/applications/${id}`, "/staff/final-collection", "/portal/documents"]) revalidatePath(p); };
const todayKigali = () => new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10);

async function caseFor(fd: FormData) {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  return { user, app: app && canWorkOnCase(user, app) ? app : null };
}

/** The consultant sets or updates the expected visa receiving date. An estimate never marks the visa as received. */
export async function setVisaEstimate(_: St, fd: FormData): Promise<St> {
  const { user, app } = await caseFor(fd);
  if (!app) return { error: "You can't work on this application." };
  if (app.status !== "ACTIVE" || app.stage !== "VISA_PROCESSING") return { error: "Expected visa dates are set while the application is at Visa processing." };
  const d = str(fd, "expectedDate", 10), t = str(fd, "expectedTime", 5), note = str(fd, "note", 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return { error: "Enter the expected date." };
  if (d < todayKigali()) return { error: "The expected date can't be in the past." };
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return { error: "Enter the time as HH:MM, or leave it empty." };
  const [prev] = await db.select().from(s.visaEstimates).where(eq(s.visaEstimates.applicationId, app.id)).orderBy(desc(s.visaEstimates.createdAt)).limit(1);
  if (prev && prev.expectedDate === d && (prev.expectedTime ?? "") === t && (prev.note ?? "") === note) return { error: "Nothing changed." };
  const when = estimateText(d, t || null);
  await db.transaction(async (tx) => {
    const [e] = await tx.insert(s.visaEstimates).values({ applicationId: app.id, expectedDate: d, expectedTime: t || null, note: note || null, setById: user.id }).returning({ id: s.visaEstimates.id });
    await logActivity(tx, { actorId: user.id, action: prev ? "visa_estimate.updated" : "visa_estimate.set", entityType: "visa_estimate", entityId: e.id, applicationId: app.id, summary: `${user.name} ${prev ? "updated" : "set"} the expected visa date of ${app.reference}: ${when}`, changes: { expected: [prev ? `${prev.expectedDate} ${prev.expectedTime ?? ""}`.trim() : null, `${d} ${t}`.trim()] } });
    await notify(tx, { userId: app.clientId, title: prev ? "Expected visa date updated" : "Expected visa date", body: `${app.reference}: estimated ${when}. This is an estimate, not a confirmed issue date.`, link: `/portal/applications/${app.id}#visa`, section: "visa", applicationId: app.id });
  });
  await emailUser(app.clientId, `Expected visa date for ${app.reference}`, `Your consultant ${prev ? "updated" : "set"} the expected date for receiving your visa: ${when}.${note ? `\n\n${note}` : ""}\n\nPlease note this is an estimate, not a guaranteed or officially confirmed date. We'll tell you as soon as the visa is actually received.`, `/portal/applications/${app.id}#visa`);
  refresh(app.id);
  return { ok: `Expected visa date ${prev ? "updated" : "saved"}. The client has been notified.` };
}

/** At Final collection the client chooses to visit the office or continue remotely. */
export async function chooseFinalCollection(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, str(fd, "applicationId", 64)), eq(s.applications.clientId, user.id)) });
  if (!app) return { error: "Application not found." };
  if (app.status !== "ACTIVE" || app.stage !== "FINAL_COLLECTION") return { error: "This choice is made at Final collection." };
  const mode = str(fd, "mode", 10);
  if (mode !== "OFFICE" && mode !== "REMOTE") return { error: "Choose how you want to continue." };
  if (mode === app.finalCollectionMode) return { error: "That's already your choice." };
  const what = mode === "REMOTE" ? "continue remotely" : "visit the office";
  await db.transaction(async (tx) => {
    await tx.update(s.applications).set({ finalCollectionMode: mode, finalCollectionChosenAt: new Date() }).where(eq(s.applications.id, app.id));
    await logActivity(tx, { actorId: user.id, action: "final_collection.choice", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${user.name} chose to ${what} for Final collection (${app.reference})`, changes: { finalCollectionMode: [app.finalCollectionMode, mode] } });
    const to = app.consultantId ? { userId: app.consultantId } : { role: "ADMIN" as const };
    await notify(tx, { ...to, title: mode === "REMOTE" ? "Client will continue remotely" : "Client will visit the office", body: `${app.reference}: Final collection${mode === "REMOTE" ? ". Upload their documents under Final collection." : "."}`, link: mode === "REMOTE" ? `/staff/final-collection#app-${app.id}` : `/staff/applications/${app.id}#final`, section: "final", applicationId: app.id });
  });
  if (app.consultantId) await emailUser(app.consultantId, `${app.reference}: client chose to ${what}`, `${user.name} chose to ${what} for Final collection.`, `/staff/final-collection`);
  refresh(app.id);
  return { ok: mode === "REMOTE" ? "Noted: you'll continue remotely. Your consultant will share your documents here." : "Noted: you'll visit the office. Your consultant will confirm the time." };
}

/** The assigned consultant (or an admin) uploads a Final collection document, or a new version of one. */
export async function uploadFinalDocument(_: St, fd: FormData): Promise<St> {
  const { user, app } = await caseFor(fd);
  if (!app) return { error: "You can't work on this application." };
  if (app.stage !== "FINAL_COLLECTION" && app.stage !== "COMPLETED") return { error: "Final collection documents are shared once the application reaches Final collection." };
  const title = str(fd, "title", 150), category = str(fd, "category", 20), note = str(fd, "description", 1000);
  if (title.length < 2) return { error: "Give the document a title." };
  if (!(category in FINAL_CATEGORIES)) return { error: "Choose a category." };
  const replacesId = str(fd, "replacesId", 64) || null;
  const old = replacesId ? await db.query.caseFiles.findFirst({ where: and(eq(s.caseFiles.id, replacesId), eq(s.caseFiles.applicationId, app.id), eq(s.caseFiles.kind, "FINAL_DOC")) }) : null;
  if (replacesId && (!old || old.supersededAt)) return { error: "That document was already replaced. Refresh the page." };
  const file = await storeUpload(fd.get("file"), { required: true, label: "the document", imagesAndPdfOnly: true });
  if (isErr(file) || !file) return { error: isErr(file) ? file.error : "Attach the document." };
  const share = fd.get("share") === "on";
  const status = !share ? "UPLOADED" : old ? "UPDATED" : "AVAILABLE";
  await db.transaction(async (tx) => {
    const [f] = await tx.insert(s.caseFiles).values({ applicationId: app.id, kind: "FINAL_DOC", title, category, note: note || null, status, replacesId: old?.id ?? null, storageKey: file.key, fileName: file.name, mimeType: file.mime, uploadedById: user.id }).returning({ id: s.caseFiles.id });
    if (old) await tx.update(s.caseFiles).set({ supersededAt: new Date() }).where(eq(s.caseFiles.id, old.id));
    await logActivity(tx, { actorId: user.id, action: old ? "final_doc.replaced" : "final_doc.uploaded", entityType: "case_file", entityId: f.id, applicationId: app.id, summary: `${user.name} ${old ? `replaced "${old.title}" with a new version` : "uploaded"} "${title}" (${FINAL_CATEGORIES[category]}) for ${app.reference}${share ? "" : ", not shared yet"}`, changes: { status: [old?.status ?? null, status] } });
    if (share) await notify(tx, { userId: app.clientId, title: old ? "Final collection document updated" : "New Final collection document", body: `${app.reference}: ${title}${note ? `. ${note}` : ""}`, link: `/portal/applications/${app.id}#final`, section: "final", applicationId: app.id });
  });
  if (share) await emailUser(app.clientId, `${old ? "Updated" : "New"} document for ${app.reference}`, `Your consultant shared "${title}" in your FIRST FLIGHT client portal.${note ? `\n\n${note}` : ""}\n\nOpen it to preview or download it.`, `/portal/applications/${app.id}#final`);
  refresh(app.id);
  return { ok: share ? `"${title}" shared with the client.` : `"${title}" uploaded. Share it when it's ready.` };
}

/** Shares a document uploaded without sharing. */
export async function shareFinalDocument(_: St, fd: FormData): Promise<St> {
  const { user, app } = await caseFor(fd);
  if (!app) return { error: "You can't work on this application." };
  const f = await db.query.caseFiles.findFirst({ where: and(eq(s.caseFiles.id, str(fd, "fileId", 64)), eq(s.caseFiles.applicationId, app.id), eq(s.caseFiles.kind, "FINAL_DOC")) });
  if (!f || f.supersededAt || f.status !== "UPLOADED") return { error: "This document can't be shared now." };
  const status = f.replacesId ? "UPDATED" : "AVAILABLE";
  await db.transaction(async (tx) => {
    await tx.update(s.caseFiles).set({ status }).where(eq(s.caseFiles.id, f.id));
    await logActivity(tx, { actorId: user.id, action: "final_doc.shared", entityType: "case_file", entityId: f.id, applicationId: app.id, summary: `${user.name} shared "${f.title}" with the client of ${app.reference}`, changes: { status: ["UPLOADED", status] } });
    await notify(tx, { userId: app.clientId, title: "New Final collection document", body: `${app.reference}: ${f.title}`, link: `/portal/applications/${app.id}#final`, section: "final", applicationId: app.id });
  });
  refresh(app.id);
  return { ok: `"${f.title}" shared with the client.` };
}

/** The client says a document needs correcting. */
export async function requestDocumentCorrection(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const f = await db.query.caseFiles.findFirst({ where: and(eq(s.caseFiles.id, str(fd, "fileId", 64)), eq(s.caseFiles.kind, "FINAL_DOC")), with: { application: true } });
  if (!f || f.application.clientId !== user.id || f.supersededAt || f.status === "UPLOADED") return { error: "Document not found." };
  const note = str(fd, "note", 1000);
  if (note.length < 5) return { error: "Say what needs correcting." };
  await db.transaction(async (tx) => {
    await tx.update(s.caseFiles).set({ status: "CORRECTION_REQUIRED", correctionNote: note }).where(eq(s.caseFiles.id, f.id));
    await logActivity(tx, { actorId: user.id, action: "final_doc.correction_requested", entityType: "case_file", entityId: f.id, applicationId: f.applicationId, summary: `${user.name} asked for a correction to "${f.title}" (${f.application.reference}): ${note}`, changes: { status: [f.status, "CORRECTION_REQUIRED"] } });
    const to = f.application.consultantId ? { userId: f.application.consultantId } : { role: "ADMIN" as const };
    await notify(tx, { ...to, title: "Correction requested on a Final collection document", body: `${f.application.reference}: "${f.title}": ${note}`, link: `/staff/final-collection#app-${f.applicationId}`, section: "final", applicationId: f.applicationId });
  });
  refresh(f.applicationId);
  return { ok: "Your consultant has been asked to correct it." };
}
