"use server";
// Offer letters (at Getting offer) and visa records (at Visa processing), uploaded by the assigned consultant or an
// admin. Each one can make a scheduled instalment payable, and may let the application move on automatically.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { isErr, storeUpload } from "@/lib/upload";
import { autoAdvance } from "@/lib/progress";
import { STAGES, STAGE_LABEL } from "@/lib/format";
import { needsOffer } from "@/lib/schedule";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);
const at = (st: string) => STAGES.indexOf(st as (typeof STAGES)[number]);
const dateOf = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00+02:00`) : null);

async function upload(fd: FormData, kind: "OFFER_LETTER" | "VISA") {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || !canWorkOnCase(user, app)) return { error: "You can't work on this application." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  if (kind === "OFFER_LETTER") {
    if (!needsOffer(app.service)) return { error: "Visa-only applications don't have an offer letter." };
    if (at(app.stage) < at("GETTING_OFFER")) return { error: `Move the application to ${STAGE_LABEL.GETTING_OFFER} before uploading the offer letter.` };
  } else if (at(app.stage) < at("VISA_PROCESSING")) return { error: `Move the application to ${STAGE_LABEL.VISA_PROCESSING} before recording the visa.` };
  const issuedOn = dateOf(str(fd, "issuedOn", 10));
  if (kind === "VISA" && !issuedOn) return { error: "Enter the date the visa was issued." };
  if (issuedOn && +issuedOn > Date.now() + 86_400_000) return { error: "The date can't be in the future." };
  const file = await storeUpload(fd.get("file"), { required: true, label: kind === "VISA" ? "a copy of the visa" : "the offer letter", imagesAndPdfOnly: true });
  if (isErr(file) || !file) return { error: isErr(file) ? file.error : "Attach the file." };
  const what = kind === "VISA" ? "visa" : "offer letter";
  const title = str(fd, "title", 120) || (kind === "VISA" ? "Visa" : "Offer letter");
  await db.transaction(async (tx) => {
    const [f] = await tx.insert(s.caseFiles).values({ applicationId: app.id, kind, title, note: str(fd, "note", 1000) || null, issuedOn, storageKey: file.key, fileName: file.name, mimeType: file.mime, uploadedById: user.id }).returning({ id: s.caseFiles.id });
    await logActivity(tx, { actorId: user.id, action: kind === "VISA" ? "visa.recorded" : "offer.uploaded", entityType: "case_file", entityId: f.id, applicationId: app.id, summary: `${user.name} ${kind === "VISA" ? "recorded the visa" : "uploaded the offer letter"} for ${app.reference}${issuedOn ? ` (dated ${issuedOn.toLocaleDateString("en-GB")})` : ""}` });
    await notify(tx, { userId: app.clientId, title: kind === "VISA" ? "Your visa has been recorded" : "Your offer letter is available", body: `${app.reference}: open it in your client portal.`, link: `/portal/viewer/case/${f.id}` });
    if (app.consultantId && app.consultantId !== user.id) await notify(tx, { userId: app.consultantId, title: `${what[0].toUpperCase()}${what.slice(1)} added`, body: app.reference, link: `/staff/applications/${app.id}#offer` });
    await notify(tx, { role: "FINANCE", title: `${what[0].toUpperCase()}${what.slice(1)} received`, body: `${app.reference}: any instalment payable after the ${what} is now invoiced.`, link: `/staff/applications/${app.id}#invoices` });
    // Invoices instalments payable after the offer letter / visa, and moves on if their payment is already approved.
    await autoAdvance(tx, app.id, user.id);
  });
  await emailUser(app.clientId, kind === "VISA" ? `Your visa for ${app.reference}` : `Your offer letter for ${app.reference}`, `${kind === "VISA" ? "Your visa has been recorded" : "Your offer letter has arrived"}. You can open and download it in your FIRST FLIGHT client portal, where you'll also see anything that is now payable.`, `/portal/applications/${app.id}#offer`);
  for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`]) revalidatePath(p);
  return { ok: kind === "VISA" ? "Visa recorded. The client has been notified." : "Offer letter uploaded. The client has been notified." };
}

export async function uploadOfferLetter(_: St, fd: FormData): Promise<St> { return upload(fd, "OFFER_LETTER"); }
export async function recordVisa(_: St, fd: FormData): Promise<St> { return upload(fd, "VISA"); }
