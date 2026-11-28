import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { logActivity, notify } from "./activity";
import { nextRef } from "./refs";
import { balanceOf, fromCents, parseAmount } from "./finance";
import { money } from "./format";
import { getRefundPolicy } from "./settings";
import { afterCompletion, refundEligibility } from "./refund-policy";
import { OPEN_STATES, firstPaymentAt } from "./refunds";
import { sameName } from "./contracts";

const str = (fd: FormData, k: string, n = 2000) => String(fd.get(k) ?? "").trim().slice(0, n);

/**
 * Validates and records a refund or reapplication request, from the client's online form or a paper form a staff
 * member uploads. Eligibility, one open request per application and the amount ceiling are checked here.
 */
export async function createRefundRequest(o: { appId: string; fd: FormData; actor: { id: string; name: string; role: string }; source: "ONLINE" | "PAPER"; file: { key: string; name: string } | null }): Promise<{ ok: string } | { error: string }> {
  const { fd, actor } = o;
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, o.appId), with: { client: { columns: { id: true, name: true } }, invoices: { with: { payments: true } } } });
  if (!app) return { error: "Application not found." };
  const kind = str(fd, "kind", 20) === "REAPPLICATION" ? "REAPPLICATION" : "REFUND";
  const policy = await getRefundPolicy(app.service);
  if (kind === "REAPPLICATION" && !policy.allowReapplication) return { error: "Reapplication instead of a refund isn't offered for this service." };
  if (app.status === "COMPLETED") {
    // After completion each option opens on its own date (completion date + its waiting period). Checked here, so
    // an early request sent straight to the server is refused just like the disabled button.
    if (!app.completedAt) return { error: "The completion date isn't recorded. Ask an administrator to set it." };
    const w = afterCompletion(app.completedAt, kind === "REFUND" ? policy.refundAfterCompletionDays : policy.reapplyAfterCompletionDays);
    if (w.state === "WAITING") return { error: `${kind === "REFUND" ? "Refund" : "Reapplication"} requests for this application open on ${w.opensOn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" })} (in ${w.daysLeft} day${w.daysLeft === 1 ? "" : "s"}).` };
    if (kind === "REFUND" && !firstPaymentAt(app.invoices)) return { error: "Refunds apply to approved payments. There's none on this application." };
  } else {
    const elig = refundEligibility(policy, firstPaymentAt(app.invoices));
    if (elig.state === "NO_PAYMENT") return { error: elig.text };
    if (kind === "REFUND" && elig.state !== "OPEN") return { error: elig.text };
  }
  const reason = str(fd, "reason");
  if (reason.length < 10) return { error: "Explain the reason (at least a sentence)." };
  const declarationName = str(fd, "declarationName", 120);
  if (o.source === "ONLINE") {
    if (fd.get("declaration") !== "on") return { error: "Confirm that the information is correct." };
    if (!sameName(declarationName, app.client.name)) return { error: `Type your full name exactly as on your account (${app.client.name}) to sign.` };
  }
  let invoiceId: string | null = null, amount: string | null = null, currency: string | null = null, paidOnInvoice: string | null = null;
  let payoutMethod: "BANK_TRANSFER" | "MOBILE_MONEY" | null = null, accountName: string | null = null, accountDetails: string | null = null;
  if (kind === "REFUND") {
    const inv = app.invoices.find((i) => i.id === str(fd, "invoiceId", 64));
    if (!inv || !inv.payments.length) return { error: "Choose the paid invoice you want refunded." };
    const paid = balanceOf({ ...inv, status: "ISSUED" }).paid;
    const cents = parseAmount(str(fd, "amount", 30));
    if (cents === null) return { error: "Enter the amount you are asking for." };
    if (cents > paid) return { error: `The most that can be refunded on ${inv.number} is ${money(fromCents(paid), inv.currency)}, the amount paid.` };
    const method = str(fd, "method", 20);
    if (method !== "BANK_TRANSFER" && method !== "MOBILE_MONEY") return { error: "Choose bank transfer or mobile money for the refund." };
    accountName = str(fd, "accountName", 120); accountDetails = str(fd, "accountDetails", 300);
    if (accountName.length < 3) return { error: "Enter the name on the account." };
    if (accountDetails.length < 6) return { error: method === "MOBILE_MONEY" ? "Enter the mobile money number." : "Enter the bank name and account number." };
    invoiceId = inv.id; amount = fromCents(cents); currency = inv.currency; paidOnInvoice = fromCents(paid); payoutMethod = method;
  }
  return db.transaction(async (tx) => {
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
    const open = await tx.query.refundRequests.findFirst({ where: and(eq(s.refundRequests.applicationId, app.id), inArray(s.refundRequests.state, OPEN_STATES)), columns: { reference: true } });
    if (open) return { error: `Request ${open.reference} is still open on this application. Wait for it to finish before sending another.` };
    const reference = await nextRef(tx, "RF");
    const [r] = await tx.insert(s.refundRequests).values({
      reference, applicationId: app.id, invoiceId, clientId: app.clientId, reason, kind, state: "SUBMITTED", source: o.source,
      amountRequested: amount, amountPaid: paidOnInvoice, currency, payoutMethod, accountName, accountDetails, paymentReference: str(fd, "paymentReference", 80) || null,
      declarationName: declarationName || null, formKey: o.file?.key ?? null, formName: o.file?.name ?? null, formSubmittedAt: new Date(), createdById: actor.id,
    }).returning({ id: s.refundRequests.id });
    const what = kind === "REFUND" ? "refund" : "reapplication";
    await logActivity(tx, { actorId: actor.id, action: `refund.submitted`, entityType: "refund", entityId: r.id, applicationId: app.id, summary: `${actor.name} submitted ${what} request ${reference} for ${app.reference}${o.source === "PAPER" ? " (paper form uploaded)" : ""}` });
    const reviewLink = "/staff/refunds";
    await notify(tx, app.consultantId ? { userId: app.consultantId, title: `New ${what} request`, body: `${reference} on ${app.reference} needs your review.`, link: reviewLink, section: kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: app.id } : { role: "ADMIN", title: `New ${what} request`, body: `${reference} on ${app.reference} (no consultant assigned) needs a review.`, link: reviewLink, section: kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: app.id });
    if (o.source === "PAPER") await notify(tx, { userId: app.clientId, title: `Your ${what} request was recorded`, body: `${reference}: we've recorded your paper form. Track it in your portal.`, link: "/portal/refunds", section: kind === "REAPPLICATION" ? "reapplication" : "refunds", applicationId: app.id });
    return { ok: `${kind === "REFUND" ? "Refund" : "Reapplication"} request ${reference} submitted. You can track every step here.` };
  });
}
