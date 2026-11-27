"use server";
// Formal amendments to a signed contract: the assigned consultant (or an admin) drafts it, Finance confirms any fee
// change, an administrator approves, and the client signs online. A fee change is applied only once signed.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canWorkOnCase } from "@/lib/permissions";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { fromCents, parseAmount } from "@/lib/finance";
import { money } from "@/lib/format";
import type { FeePlan } from "@/lib/fees";
import { nextRef } from "@/lib/refs";
import { saveBytes } from "@/lib/storage";
import { isErr, storeUpload } from "@/lib/upload";
import { sameName, signedContractPdf } from "@/lib/contracts";
import { activateDue } from "@/lib/fee-plan";
import { conditionOf, conditionText } from "@/lib/schedule";
import { AMENDMENT_KINDS } from "@/lib/requests";

type St = { ok?: string; error?: string } | undefined;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);
const refresh = (id: string) => { revalidatePath(`/staff/applications/${id}`); revalidatePath(`/portal/applications/${id}`); revalidatePath("/staff/amendments"); };

/** What's billed and can't be voided: invoices with any payment. Unpaid invoices are voided by a fee change. */
async function feePosition(x: typeof db | Tx, appId: string) {
  const invs = await x.query.invoices.findMany({ where: eq(s.invoices.applicationId, appId), with: { payments: true } });
  const live = invs.filter((i) => i.status !== "VOID");
  const keep = live.filter((i) => i.payments.length > 0);
  const voidable = live.filter((i) => i.payments.length === 0);
  const keptCents = keep.reduce((t, i) => t + Math.round(Number(i.amount) * 100), 0);
  return { keep, voidable, keptCents, currency: live[0]?.currency ?? null };
}

export async function createAmendment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CONSULTANT", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || !canWorkOnCase(user, app)) return { error: "You can't work on this application." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  const [contract] = await db.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.applicationId, app.id), eq(s.contracts.kind, "CONTRACT"))).limit(1);
  if (!contract) return { error: "There's no signed contract to amend yet." };
  const open = await db.query.amendmentRequests.findFirst({ where: and(eq(s.amendmentRequests.applicationId, app.id), eq(s.amendmentRequests.source, "STAFF"), inArray(s.amendmentRequests.state, ["PENDING_FINANCE", "PENDING_APPROVAL", "AWAITING_SIGNATURE"])) });
  if (open) return { error: "An amendment is already in progress on this application." };
  const kind = str(fd, "kind", 20);
  if (!(kind in AMENDMENT_KINDS)) return { error: "Choose what the amendment changes." };
  const details = str(fd, "details", 4000), reason = str(fd, "reason", 1000);
  if (details.length < 10) return { error: "Write the amended terms, as the client will sign them." };
  if (reason.length < 5) return { error: "Give the reason for the amendment." };
  const rawFee = str(fd, "newFee", 30);
  let newFeeAmount: string | null = null;
  if (rawFee) {
    const cents = parseAmount(rawFee);
    if (cents === null || cents <= 0) return { error: "Enter the new total fee, or leave it empty." };
    const pos = await feePosition(db, app.id);
    if (cents < pos.keptCents) return { error: `The new fee can't be lower than ${money(fromCents(pos.keptCents), pos.currency ?? "USD")}, already billed on paid invoices. Use a refund request for money to give back.` };
    newFeeAmount = fromCents(cents);
  }
  const file = await storeUpload(fd.get("attachment"), { required: false, label: "the attachment", imagesAndPdfOnly: true });
  if (isErr(file)) return { error: file.error };
  const state = newFeeAmount ? "PENDING_FINANCE" : "PENDING_APPROVAL";
  await db.transaction(async (tx) => {
    const [a] = await tx.insert(s.amendmentRequests).values({ applicationId: app.id, clientId: app.clientId, kind, details, reason, source: "STAFF", state, contractId: contract.id, newFeeAmount, attachmentKey: file?.key ?? null, attachmentName: file?.name ?? null, createdById: user.id }).returning({ id: s.amendmentRequests.id });
    await logActivity(tx, { actorId: user.id, action: "amendment.drafted", entityType: "amendment", entityId: a.id, applicationId: app.id, summary: `${user.name} drafted a contract amendment for ${app.reference}${newFeeAmount ? " (changes the fee)" : ""}` });
    await notify(tx, newFeeAmount ? { role: "FINANCE", title: "Amendment changes a fee", body: `${app.reference}: confirm the new fee.`, link: "/staff/amendments" } : { role: "ADMIN", title: "Amendment to approve", body: app.reference, link: "/staff/amendments" });
  });
  refresh(app.id);
  return { ok: newFeeAmount ? "Amendment drafted. Finance confirms the fee change, then an administrator approves it." : "Amendment drafted. An administrator will approve it before the client signs." };
}

/** Finance confirms (or rejects) the fee change; an administrator then approves (or rejects) the amendment. */
export async function reviewAmendment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const a = await db.query.amendmentRequests.findFirst({ where: and(eq(s.amendmentRequests.id, str(fd, "amendmentId", 64)), eq(s.amendmentRequests.source, "STAFF")), with: { application: true } });
  if (!a) return { error: "Amendment not found." };
  const approve = str(fd, "decision", 10) === "approve";
  const note = str(fd, "note", 1000);
  if (!approve && note.length < 5) return { error: "Give the reason for rejecting it." };
  const finance = a.state === "PENDING_FINANCE";
  if (finance && user.role !== "FINANCE" && user.role !== "ADMIN") return { error: "Finance confirms fee changes." };
  if (!finance && (a.state !== "PENDING_APPROVAL" || user.role !== "ADMIN")) return { error: a.state === "PENDING_APPROVAL" ? "Only an administrator approves amendments." : "This amendment isn't waiting for a decision." };
  const next = !approve ? "REJECTED" : finance ? "PENDING_APPROVAL" : "AWAITING_SIGNATURE";
  const ok = await db.transaction(async (tx) => {
    const [cur] = await tx.select({ state: s.amendmentRequests.state }).from(s.amendmentRequests).where(eq(s.amendmentRequests.id, a.id)).for("update");
    if (cur.state !== a.state) return false;
    await tx.update(s.amendmentRequests).set(finance ? { state: next, decidedById: user.id, decidedAt: new Date(), decisionNote: note || null } : { state: next, approvedById: approve ? user.id : null, approvedAt: approve ? new Date() : null, decisionNote: note || null, decidedById: user.id, decidedAt: new Date() }).where(eq(s.amendmentRequests.id, a.id));
    await logActivity(tx, { actorId: user.id, action: `amendment.${finance ? "finance_" : ""}${approve ? "approved" : "rejected"}`, entityType: "amendment", entityId: a.id, applicationId: a.applicationId, summary: `${user.name} ${approve ? (finance ? "confirmed the fee change on" : "approved") : "rejected"} the amendment for ${a.application.reference}` });
    if (a.createdById) await notify(tx, { userId: a.createdById, title: approve ? (finance ? "Fee change confirmed" : "Amendment approved") : "Amendment rejected", body: `${a.application.reference}${note ? `: ${note}` : ""}`, link: `/staff/applications/${a.applicationId}#contract` });
    if (approve && finance) await notify(tx, { role: "ADMIN", title: "Amendment to approve", body: a.application.reference, link: "/staff/amendments" });
    if (next === "AWAITING_SIGNATURE") await notify(tx, { userId: a.clientId, title: "Please sign a contract amendment", body: `${a.application.reference}: review and sign the amendment.`, link: `/portal/applications/${a.applicationId}#contract` });
    return true;
  });
  if (!ok) return { error: "Someone else has already decided this. Refresh the page." };
  if (next === "AWAITING_SIGNATURE") await emailUser(a.clientId, `Contract amendment for ${a.application.reference}`, "An amendment to your service contract is ready. Please review and sign it in your client portal.", `/portal/applications/${a.applicationId}#contract`);
  refresh(a.applicationId);
  return { ok: !approve ? "Amendment rejected." : finance ? "Fee change confirmed. An administrator approves next." : "Amendment approved. The client has been asked to sign." };
}

/** The client signs the approved amendment. A fee change voids unpaid instalments and bills the new balance. */
export async function signAmendment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["CLIENT"]);
  const a = await db.query.amendmentRequests.findFirst({ where: and(eq(s.amendmentRequests.id, str(fd, "amendmentId", 64)), eq(s.amendmentRequests.clientId, user.id), eq(s.amendmentRequests.source, "STAFF")), with: { application: { with: { client: { columns: { name: true } } } } } });
  if (!a) return { error: "Amendment not found." };
  if (a.state !== "AWAITING_SIGNATURE") return { error: "This amendment isn't waiting for your signature." };
  if (fd.get("agree") !== "on") return { error: "Tick the box to confirm you accept the amendment." };
  const name = str(fd, "signedName", 120);
  if (!sameName(name, a.application.client.name)) return { error: `Type your full name exactly as on your account (${a.application.client.name}).` };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const now = new Date();
  const app = a.application;
  const res = await db.transaction(async (tx) => {
    const [cur] = await tx.select({ state: s.amendmentRequests.state }).from(s.amendmentRequests).where(eq(s.amendmentRequests.id, a.id)).for("update");
    if (cur.state !== "AWAITING_SIGNATURE") return { error: "This amendment isn't waiting for your signature." };
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
    let feeText = "";
    if (a.newFeeAmount) {
      const pos = await feePosition(tx, app.id);
      const newCents = Math.round(Number(a.newFeeAmount) * 100);
      if (newCents < pos.keptCents) return { error: "Payments changed since this amendment was approved. Ask your consultant to redo it." };
      const oldPlan = app.feePlan as FeePlan | null;
      const currency = oldPlan?.currency ?? pos.currency ?? "USD";
      for (const inv of pos.voidable) await tx.update(s.invoices).set({ status: "VOID" }).where(eq(s.invoices.id, inv.id));
      // Paid instalments stay as they are; the new balance becomes one instalment payable under the condition of the
      // first instalment that wasn't paid yet (so nothing is billed before it's due).
      const keptIds = new Set(pos.keep.map((i) => i.id));
      const oldRows = oldPlan?.installments ?? [];
      const rows: FeePlan["installments"] = pos.keep.map((i) => { const was = oldRows.find((r) => r.invoiceId === i.id); return { ...(was ?? {}), label: was?.label ?? i.description, amount: i.amount, dueDate: (i.dueDate ?? i.createdAt).toISOString(), invoiceId: i.id, invoiceNumber: i.number }; });
      const firstOpen = oldRows.find((r) => !r.invoiceId || !keptIds.has(r.invoiceId));
      const rest = newCents - pos.keptCents;
      if (rest > 0) rows.push({ label: "Balance after contract amendment", amount: fromCents(rest), condition: firstOpen ? conditionOf(firstOpen) : "INITIAL", dueDays: 14, loanEligible: false, historical: false, dueDate: null, invoiceId: null, invoiceNumber: null });
      const plan: FeePlan = { ruleId: oldPlan?.ruleId ?? "amendment", ruleName: `Amended: ${oldPlan?.ruleName ?? "service fee"}`, amount: a.newFeeAmount, currency, appliedAt: now.toISOString(), appliedBy: "Contract amendment", confirmedAt: now.toISOString(), confirmedBy: "Contract amendment", confirmedById: a.approvedById ?? user.id, installments: rows };
      const history = [...((app.feePlanHistory as FeePlan[] | null) ?? []), ...(oldPlan ? [oldPlan] : [])];
      await tx.update(s.applications).set({ feePlan: plan, feePlanHistory: history }).where(eq(s.applications.id, app.id));
      feeText = `\n\nNew total service fee: ${money(a.newFeeAmount, currency)}. Unpaid instalments under the previous fee are cancelled${rest > 0 ? `; the balance of ${money(fromCents(rest), currency)} is payable ${firstOpen ? conditionText(conditionOf(firstOpen)).replace("Payable ", "").toLowerCase() : "now"}` : ""}.`;
    }
    const number = await nextRef(tx, "AM");
    const title = `Contract amendment: ${AMENDMENT_KINDS[a.kind as keyof typeof AMENDMENT_KINDS] ?? a.kind}`;
    const body = `This amendment changes the service contract for ${app.reference}.\n\n${a.details}\n\nReason: ${a.reason ?? "-"}${feeText}\n\nAll other terms of the signed contract stay the same.`;
    const key = await saveBytes(await signedContractPdf({ title, number, body, signedName: name, signedAt: now, ip, version: null }), "application/pdf");
    const [c] = await tx.insert(s.contracts).values({ applicationId: app.id, kind: "AMENDMENT", method: "ONLINE", title, body, signedName: name, signedAt: now, signedById: user.id, signedIp: ip, signedUserAgent: (h.get("user-agent") ?? "").slice(0, 300) || null, storageKey: key, fileName: `${number}.pdf`, mimeType: "application/pdf", amendmentId: a.id, supersedesId: a.contractId }).returning({ id: s.contracts.id });
    await tx.update(s.amendmentRequests).set({ state: "SIGNED", status: "APPROVED", signedContractId: c.id }).where(eq(s.amendmentRequests.id, a.id));
    await logActivity(tx, { actorId: user.id, action: "amendment.signed", entityType: "amendment", entityId: a.id, applicationId: app.id, summary: `${user.name} signed contract amendment ${number} for ${app.reference}${a.newFeeAmount ? ` (new fee applied)` : ""}` });
    for (const uid of [a.createdById, app.consultantId].filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i)) await notify(tx, { userId: uid, title: "Amendment signed", body: app.reference, link: `/staff/applications/${app.id}#contract` });
    if (a.newFeeAmount) await notify(tx, { role: "FINANCE", title: "Fee changed by a signed amendment", body: app.reference, link: `/staff/applications/${app.id}` });
    if (a.newFeeAmount) await activateDue(tx, app.id, a.approvedById ?? user.id);
    return { ok: "Amendment signed. A copy is saved with your contract." };
  });
  refresh(app.id);
  return res;
}

