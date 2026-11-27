"use server";
// Consultants (and admins) register clients: new clients met at the office, and existing clients served manually
// before the platform. The client sets their own password from an activation link; staff never see or set it.
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { hasService } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { sendEmail, siteUrl } from "@/lib/email";
import { createActivationToken } from "@/lib/tokens";
import { resolveSelection } from "@/lib/selection";
import { activeApplication, createApplication } from "@/lib/create-application";
import { eligibleConsultant } from "@/lib/assignment";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/format";
import { fromCents, normaliseRef, parseAmount } from "@/lib/finance";
import { isErr, storeUpload } from "@/lib/upload";
import { needsOffer } from "@/lib/schedule";
import { COMPANY } from "@/lib/company";
import { SERVICE_LABEL } from "@/lib/format";

export type ClientState = { ok?: string; error?: string; link?: string; applicationId?: string } | undefined;

const Schema = z.object({
  name: z.string().trim().min(2, "Enter the client's full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().min(8, "Enter the client's phone number with country code").max(30),
  listing: z.string().trim().max(80).optional(),
  nat: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(), res: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  note: z.string().trim().max(2000).optional(),
  consultantId: z.string().trim().max(64).optional(),
});
const digits = (p: string) => p.replace(/\D/g, "").replace(/^0+/, "");

type Stored = { key: string; name: string; mime: string };
type History = {
  stage: Stage; started: Date | null; reached: Date | null;
  files: { kind: string; title: string; issuedOn: Date | null; file: Stored }[]; contract: { signedAt: Date; file: Stored } | null;
  payments: { cents: number; currency: string; method: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CARD"; reference: string; paidAt: Date; file: Stored | null }[];
};
const at = (st: string) => STAGES.indexOf(st as Stage);
const dateOf = (v: FormDataEntryValue | null) => { const x = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(`${x}T12:00:00+02:00`) : null; };
const welcome = (name: string, by: string, link: string, existing: boolean) => `Hello ${name},

Welcome to the FIRST FLIGHT client portal. ${by} has ${existing ? "added your application to" : "created"} your FIRST FLIGHT account${existing ? "" : " for you"}.

In the portal you can follow your application online: every stage, your documents, invoices, receipts and messages from your consultant, and continue the remaining steps without visiting the office unless it's really needed.

Open this secure link within 7 days to choose your own password and sign in:
${link}

We will never send you a password by email. If you need help, contact us at ${COMPANY.email} or ${COMPANY.phones.join(" / ")}.

FIRST FLIGHT BEST TRAVEL SOLUTION LTD`;

/**
 * Registers a client from the office: a new client, or an existing client served manually before the platform
 * (with their real current stage, documents and verified past payments). A consultant who registers a client is
 * assigned to them; an admin may pick the consultant. The client sets their own password from a time-limited link.
 * An email that already has a client account is never duplicated: the application can be added to that account
 * and an access link sent to its owner.
 */
export async function createClientAccount(_: ClientState, fd: FormData): Promise<ClientState> {
  const me = await requireUser(["CONSULTANT", "ADMIN"]);
  const p = Schema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]).filter(([, v]) => v !== "")));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const existingClient = fd.get("mode") === "existing";
  const link2existing = fd.get("linkExisting") === "on";
  const found = await db.query.users.findFirst({ where: eq(s.users.email, d.email), columns: { id: true, name: true, role: true } });
  if (found && (found.role !== "CLIENT" || !link2existing)) return { error: found.role === "CLIENT" ? `${found.name} already has an account with this email. Tick "Add to the existing account" to open the application on it (an access link is sent to them), instead of creating a duplicate.` : "This email belongs to a staff account. Use the client's own email." };
  if (!found) {
    const samePhone = (await db.select({ phone: s.users.phone }).from(s.users).where(eq(s.users.role, "CLIENT"))).some((u) => u.phone && digits(u.phone).endsWith(digits(d.phone).slice(-9)));
    if (samePhone) return { error: "A client with this phone number already exists. Check you are not creating a duplicate account." };
  }
  if (existingClient && !d.listing) return { error: "Choose the service the existing client is receiving." };
  // The service the application is for: "job:ID", "program:ID" or "visa:ID".
  let sel = null;
  if (d.listing) {
    const [kind, id] = d.listing.split(":");
    sel = await resolveSelection(kind === "visa" ? { visa: id, nat: d.nat ?? "RW", res: d.res ?? "RW", dest: (await db.query.visaGuidance.findFirst({ where: eq(s.visaGuidance.id, id), columns: { destinationIso: true } }))?.destinationIso } : { [kind]: id });
    if (!sel) return { error: "That listing is no longer published." };
    if (!hasService(me, sel.service)) return { error: `You're not authorised for ${SERVICE_LABEL[sel.service]}.` };
  }
  if (found && sel && (await activeApplication(found.id))) return { error: `${found.name} already has an application in progress. Open it instead of creating another.` };
  // Who serves the client: the consultant registering them, or the consultant an admin picks (optional).
  let assignTo: { id: string; name: string; self: boolean } | undefined;
  if (sel && me.role === "CONSULTANT") assignTo = { id: me.id, name: me.name, self: true };
  if (sel && me.role === "ADMIN" && d.consultantId) {
    const k = await eligibleConsultant(d.consultantId, sel.service);
    if (!k) return { error: "That consultant doesn't hold this service." };
    assignTo = { ...k, self: false };
  }

  // Existing clients: real stage, documents and past payments, validated before anything is saved.
  let history = null as History | null;
  if (existingClient && sel) {
    const stage = String(fd.get("stage") ?? "") as Stage;
    if (!STAGES.includes(stage)) return { error: "Choose the client's actual current stage." };
    const started = dateOf(fd.get("startedOn")), reached = dateOf(fd.get("stageReachedOn"));
    if ((started && +started > Date.now()) || (reached && +reached > Date.now())) return { error: "Dates can't be in the future." };
    if (started && reached && +reached < +started) return { error: "The stage can't have been reached before the service started." };
    const payments: History["payments"] = [];
    const currency = String(fd.get("currency") ?? "USD");
    for (const i of [0, 1, 2]) {
      const amt = String(fd.get(`payAmount${i}`) ?? "").trim();
      if (!amt) continue;
      const cents = parseAmount(amt), paidAt = dateOf(fd.get(`payDate${i}`)), reference = normaliseRef(String(fd.get(`payRef${i}`) ?? "")), method = String(fd.get(`payMethod${i}`) ?? "");
      if (cents === null || cents <= 0) return { error: `Payment ${i + 1}: enter the amount paid.` };
      if (!paidAt || +paidAt > Date.now() + 86_400_000) return { error: `Payment ${i + 1}: enter the date it was paid.` };
      if (reference.length < 3) return { error: `Payment ${i + 1}: enter its reference (receipt or transaction number) so Finance can check it.` };
      if (!["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD"].includes(method)) return { error: `Payment ${i + 1}: choose how it was paid.` };
      if (payments.some((x) => x.reference === reference)) return { error: `Payment ${i + 1}: that reference is entered twice.` };
      const [dupe] = await db.select({ id: s.payments.id }).from(s.payments).where(eq(s.payments.reference, reference)).limit(1);
      if (dupe) return { error: `Payment ${i + 1}: reference ${reference} is already recorded in the system.` };
      const file = await storeUpload(fd.get(`payProof${i}`), { required: false, label: `the evidence for payment ${i + 1}`, imagesAndPdfOnly: true });
      if (isErr(file)) return { error: file.error };
      payments.push({ cents, currency, method: method as "CASH", reference, paidAt, file });
    }
    const up = async (k: string, label: string) => { const f = await storeUpload(fd.get(k), { required: false, label, imagesAndPdfOnly: true }); return f; };
    const contractFile = await up("contractFile", "the signed contract"); if (isErr(contractFile)) return { error: contractFile.error };
    const offerFile = await up("offerFile", "the offer letter"); if (isErr(offerFile)) return { error: offerFile.error };
    const visaFile = await up("visaFile", "the visa"); if (isErr(visaFile)) return { error: visaFile.error };
    // The stage must agree with what was actually done.
    if (at(stage) >= at("DOCUMENT_SIGNING") && !payments.length) return { error: `A client at ${STAGE_LABEL[stage]} has paid at least the first instalment. Record it under Previous payments, with its reference.` };
    if (at(stage) >= at("PROCESSING") && !contractFile) return { error: `A client at ${STAGE_LABEL[stage]} has a signed contract. Upload the scan.` };
    if (at(stage) >= at("VISA_PROCESSING") && needsOffer(sel.service) && !offerFile) return { error: `A client at ${STAGE_LABEL[stage]} has an offer letter. Upload it.` };
    if (at(stage) >= at("FINAL_COLLECTION") && !visaFile) return { error: `A client at ${STAGE_LABEL[stage]} has a visa. Upload a copy.` };
    const signedAt = dateOf(fd.get("contractSignedOn"));
    if (contractFile && !signedAt) return { error: "Enter the date the contract was signed." };
    const files: History["files"] = [];
    if (offerFile) files.push({ kind: "OFFER_LETTER", title: "Offer letter", issuedOn: dateOf(fd.get("offerDate")), file: offerFile });
    if (visaFile) files.push({ kind: "VISA", title: "Visa", issuedOn: dateOf(fd.get("visaDate")), file: visaFile });
    for (const f of fd.getAll("otherDocs")) { const x = await storeUpload(f, { required: false, label: "a previous document", imagesAndPdfOnly: true }); if (isErr(x)) return { error: x.error }; if (x) files.push({ kind: "OTHER", title: x.name, issuedOn: null, file: x }); }
    history = { stage, started, reached, files, contract: contractFile && signedAt ? { signedAt, file: contractFile } : null, payments };
  }

  const client = found ? { id: found.id, name: found.name } : await db.transaction(async (tx) => {
    const [u] = await tx.insert(s.users).values({ name: d.name, email: d.email, phone: d.phone, role: "CLIENT", passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 12) }).returning({ id: s.users.id, name: s.users.name });
    await logActivity(tx, { actorId: me.id, action: "client.created", entityType: "user", entityId: u.id, summary: `${me.name} registered ${existingClient ? "existing " : ""}client ${d.name} (${d.email})` });
    return u;
  });
  let applicationId: string | undefined;
  if (sel) {
    const h = history;
    const r = await createApplication({ client, sel, note: d.note ?? null, actor: me, via: "staff", assignTo, afterCreate: h ? async (tx, a) => {
      await tx.update(s.applications).set({ stage: h.stage, status: h.stage === "COMPLETED" ? "COMPLETED" : "ACTIVE", origin: "EXISTING", originalStartDate: h.started, importedStageReachedAt: h.reached, importNote: d.note ?? null }).where(eq(s.applications.id, a.id));
      for (const f of h.files) await tx.insert(s.caseFiles).values({ applicationId: a.id, kind: f.kind, title: f.title, issuedOn: f.issuedOn, historical: true, storageKey: f.file.key, fileName: f.file.name, mimeType: f.file.mime, uploadedById: me.id });
      if (h.contract) await tx.insert(s.contracts).values({ applicationId: a.id, kind: "CONTRACT", method: "UPLOADED", title: "Service contract (signed before the platform)", signedAt: h.contract.signedAt, storageKey: h.contract.file.key, fileName: h.contract.file.name, mimeType: h.contract.file.mime, uploadedById: me.id });
      for (const pm of h.payments) {
        const [ev] = pm.file ? await tx.insert(s.caseFiles).values({ applicationId: a.id, kind: "PAYMENT_EVIDENCE", title: `Payment evidence ${pm.reference}`, historical: true, storageKey: pm.file.key, fileName: pm.file.name, mimeType: pm.file.mime, uploadedById: me.id }).returning({ id: s.caseFiles.id }) : [null];
        await tx.insert(s.historicalPayments).values({ applicationId: a.id, amount: fromCents(pm.cents), currency: pm.currency, method: pm.method, reference: pm.reference, paidAt: pm.paidAt, evidenceFileId: ev?.id ?? null, createdById: me.id });
      }
      // The stage is recorded as where the client already was, not as something done today.
      await logActivity(tx, { actorId: me.id, action: "application.imported", entityType: "application", entityId: a.id, applicationId: a.id,
        summary: `${me.name} registered ${a.reference} as an existing client already at ${STAGE_LABEL[h.stage]}${h.reached ? ` (reached ${h.reached.toLocaleDateString("en-GB")})` : ""}${h.started ? `; service started ${h.started.toLocaleDateString("en-GB")}` : ""}. ${h.files.length + (h.contract ? 1 : 0)} previous document(s), ${h.payments.length} previous payment(s) waiting for Finance to validate.`,
        changes: { importedStage: [null, h.stage] } });
      if (h.payments.length) await notify(tx, { role: "FINANCE", title: "Previous payments to validate", body: `${a.reference}: ${h.payments.length} payment(s) made before the platform. Confirm the schedule and validate them.`, link: `/staff/applications/${a.id}#historical` });
    } : undefined });
    if (r.existing) return { error: `${client.name} already has an application in progress (${r.existing.reference}).` };
    applicationId = r.created?.id;
  }
  const token = await createActivationToken(client.id, me.id);
  const link = `${siteUrl()}/activate?token=${token}`;
  await sendEmail(d.email, found ? "Access your FIRST FLIGHT client portal" : "Activate your FIRST FLIGHT account", welcome(found?.name ?? d.name, me.name, link, !!found));
  for (const p2 of ["/staff/available", "/staff/assignments", "/staff/applications"]) revalidatePath(p2);
  const who = assignTo ? (assignTo.self ? " It's assigned to you." : ` It's assigned to ${assignTo.name}.`) : sel ? " It's in Available clients until a consultant takes it." : "";
  return { ok: `${found ? `Application added to ${found.name}'s existing account` : `Account created for ${d.name}`}.${sel ? ` The application is open${existingClient ? ` at ${STAGE_LABEL[history!.stage]}` : ""}.${who}` : ""}${existingClient && history?.payments.length ? " Finance validates the previous payments before they count." : ""}`, link, applicationId };
}

export async function resendActivation(_: ClientState, fd: FormData): Promise<ClientState> {
  const me = await requireUser(["CONSULTANT", "ADMIN"]);
  const u = await db.query.users.findFirst({ where: and(eq(s.users.id, String(fd.get("userId") ?? "")), eq(s.users.role, "CLIENT")) });
  if (!u) return { error: "Client not found." };
  const link = `${siteUrl()}/activate?token=${await createActivationToken(u.id, me.id)}`;
  await sendEmail(u.email, "Activate your FIRST FLIGHT account", welcome(u.name, me.name, link, false));
  return { ok: "A new activation link was created; the old one no longer works.", link };
}
