"use server";
// Client requests on their own application: refunds (step 1 request, step 2 form) and service amendments.
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { nextRef } from "@/lib/refs";
import { balanceOf, fromCents, parseAmount, PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { money } from "@/lib/format";

export type ReqState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);
import { AMENDMENT_KINDS } from "@/lib/requests";

async function ownApp(fd: FormData) {
  const user = await requireUser(["CLIENT"]);
  const app = await db.query.applications.findFirst({ where: and(eq(s.applications.id, str(fd, "applicationId", 64)), eq(s.applications.clientId, user.id)) });
  return { user, app };
}

/** Step 1: the client asks for a refund of a payment on one of their invoices. */
export async function requestRefund(_: ReqState, fd: FormData): Promise<ReqState> {
  const { user, app } = await ownApp(fd);
  if (!app) return { error: "Application not found." };
  const inv = await db.query.invoices.findFirst({ where: and(eq(s.invoices.id, str(fd, "invoiceId", 64)), eq(s.invoices.applicationId, app.id)), with: { payments: true } });
  if (!inv || !inv.payments.length) return { error: "Choose an invoice you have paid." };
  const reason = str(fd, "reason");
  if (reason.length < 10) return { error: "Explain why you are asking for a refund (at least a sentence)." };
  const open = await db.query.refundRequests.findFirst({ where: and(eq(s.refundRequests.invoiceId, inv.id), inArray(s.refundRequests.status, ["REQUESTED", "FORM_OPEN", "FORM_SUBMITTED"])) });
  if (open) return { error: `You already have refund request ${open.reference} open for ${inv.number}.` };
  const ref = await db.transaction(async (tx) => {
    const reference = await nextRef(tx, "RF");
    const [r] = await tx.insert(s.refundRequests).values({ reference, applicationId: app.id, invoiceId: inv.id, clientId: user.id, reason, currency: inv.currency }).returning();
    await logActivity(tx, { actorId: user.id, action: "refund.requested", entityType: "refund", entityId: r.id, applicationId: app.id, summary: `${user.name} requested refund ${reference} on ${inv.number} (${app.reference})` });
    await notify(tx, { role: "FINANCE", title: "Refund requested", body: `${reference}: ${app.reference}, ${inv.number}`, link: "/staff/finance/refunds" });
    await notify(tx, { role: "ADMIN", title: "Refund requested", body: `${reference}: ${app.reference}, ${inv.number}`, link: "/staff/finance/refunds" });
    return reference;
  });
  revalidatePath(`/portal/applications/${app.id}`);
  return { ok: `Refund request ${ref} sent. Finance will review it; if approved, you'll be asked to fill in the refund form.` };
}

/** Step 2: after approval, the client says how much and how they want to be paid. */
export async function submitRefundForm(_: ReqState, fd: FormData): Promise<ReqState> {
  const user = await requireUser(["CLIENT"]);
  const r = await db.query.refundRequests.findFirst({ where: and(eq(s.refundRequests.id, str(fd, "refundId", 64)), eq(s.refundRequests.clientId, user.id)), with: { invoice: { with: { payments: true } }, application: { columns: { id: true, reference: true } } } });
  if (!r) return { error: "Refund request not found." };
  if (r.status !== "FORM_OPEN") return { error: "This refund form is not open." };
  const cents = parseAmount(str(fd, "amount", 30));
  const method = str(fd, "method", 20);
  const accountName = str(fd, "accountName", 120), accountDetails = str(fd, "accountDetails", 300);
  const paidCents = r.invoice ? balanceOf({ ...r.invoice, status: "ISSUED" }).paid : 0;
  if (cents === null) return { error: "Enter the amount you are asking for." };
  if (cents > paidCents) return { error: `You can ask for at most ${money(fromCents(paidCents), r.currency ?? "USD")}, the amount paid on this invoice.` };
  if (!["BANK_TRANSFER", "MOBILE_MONEY"].includes(method)) return { error: "Choose bank transfer or mobile money." };
  if (accountName.length < 3) return { error: "Enter the name on the account." };
  if (accountDetails.length < 6) return { error: method === "MOBILE_MONEY" ? "Enter the mobile money number." : "Enter the bank name and account number." };
  if (fd.get("declaration") !== "on") return { error: "Confirm that the details are correct." };
  await db.transaction(async (tx) => {
    await tx.update(s.refundRequests).set({ amountRequested: fromCents(cents), payoutMethod: method as "BANK_TRANSFER", accountName, accountDetails, formSubmittedAt: new Date(), status: "FORM_SUBMITTED" }).where(eq(s.refundRequests.id, r.id));
    await logActivity(tx, { actorId: user.id, action: "refund.form_submitted", entityType: "refund", entityId: r.id, applicationId: r.application.id, summary: `${user.name} submitted the refund form for ${r.reference}: ${money(fromCents(cents), r.currency ?? "USD")} by ${PAYMENT_METHOD_LABEL[method]}` });
    await notify(tx, { role: "FINANCE", title: "Refund form submitted", body: `${r.reference} (${r.application.reference}) is ready to pay.`, link: "/staff/finance/refunds" });
  });
  revalidatePath(`/portal/applications/${r.application.id}`);
  return { ok: "Refund form sent. Finance will process the payment and let you know." };
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
