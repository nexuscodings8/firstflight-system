"use server";
// Finance validates payments an existing client made before the platform. Only then do they count: the matching
// instalment gets its invoice (marked as paid before the platform) and a receipt with the original date. Nothing is
// invoiced twice: each instalment has at most one invoice, and references can't repeat.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { money } from "@/lib/format";
import { planConfirmed, type FeePlan } from "@/lib/fees";
import { nextRef } from "@/lib/refs";
import { approvePaymentTx, paymentError } from "@/lib/payments";

type St = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);

export async function decideHistoricalPayment(_: St, fd: FormData): Promise<St> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const h = await db.query.historicalPayments.findFirst({ where: eq(s.historicalPayments.id, str(fd, "id", 64)), with: { application: true } });
  if (!h) return { error: "Record not found." };
  if (h.status !== "PENDING") return { error: "This payment has already been decided." };
  const app = h.application;
  const refresh = () => { for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`]) revalidatePath(p); };
  if (str(fd, "decision", 10) === "reject") {
    const note = str(fd, "note", 500);
    if (note.length < 5) return { error: "Give the reason (e.g. no matching record)." };
    await db.transaction(async (tx) => {
      await tx.update(s.historicalPayments).set({ status: "REJECTED", decisionNote: note, validatedById: user.id, validatedAt: new Date() }).where(eq(s.historicalPayments.id, h.id));
      await logActivity(tx, { actorId: user.id, action: "historical_payment.rejected", entityType: "historical_payment", entityId: h.id, applicationId: app.id, summary: `${user.name} rejected previous payment ${h.reference} (${money(h.amount, h.currency)}) on ${app.reference}: ${note}`, changes: { status: ["PENDING", "REJECTED"] } });
      if (app.consultantId) await notify(tx, { userId: app.consultantId, title: "Previous payment not validated", body: `${app.reference}: ${h.reference}: ${note}`, link: `/staff/applications/${app.id}#historical` });
    });
    refresh();
    return { ok: "Rejected. It doesn't count towards the fee." };
  }
  const plan = app.feePlan as FeePlan | null;
  if (!plan || !planConfirmed(plan)) return { error: "Confirm the instalment schedule first, marking which instalments were paid before the platform." };
  const i = Number(str(fd, "instalment", 2));
  const row = plan.installments[i];
  if (!row?.historical) return { error: "Choose an instalment marked as paid before the platform." };
  if (plan.currency !== h.currency) return { error: `This payment is in ${h.currency} but the schedule is in ${plan.currency}. Record it in the schedule's currency.` };
  try {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select({ st: s.historicalPayments.status }).from(s.historicalPayments).where(eq(s.historicalPayments.id, h.id)).for("update");
      if (cur.st !== "PENDING") throw Object.assign(new Error("decided"), { code: "DECIDED" });
      await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
      const [fresh] = await tx.select({ feePlan: s.applications.feePlan }).from(s.applications).where(eq(s.applications.id, app.id));
      const p2 = fresh.feePlan as FeePlan;
      const r2 = p2.installments[i];
      let invoiceId = r2.invoiceId;
      if (!invoiceId) {
        const number = await nextRef(tx, "INV");
        const n = p2.installments.length;
        const [inv] = await tx.insert(s.invoices).values({ number, applicationId: app.id, description: `${n > 1 ? `Instalment ${i + 1} of ${n}: ` : ""}${r2.label} (paid before the platform)`, amount: r2.amount, currency: p2.currency, dueDate: h.paidAt, status: "ISSUED", createdById: user.id }).returning({ id: s.invoices.id });
        Object.assign(r2, { invoiceId: inv.id, invoiceNumber: number, dueDate: h.paidAt.toISOString(), activatedAt: new Date().toISOString() });
        await tx.update(s.applications).set({ feePlan: p2 }).where(eq(s.applications.id, app.id));
        invoiceId = inv.id;
      }
      const res = await approvePaymentTx(tx, { invoiceId, cents: Math.round(Number(h.amount) * 100), method: h.method, reference: h.reference, paidAt: h.paidAt, note: `Paid before the platform; validated by ${user.name}`, actor: user, historical: true });
      await tx.update(s.historicalPayments).set({ status: "VALIDATED", decisionNote: str(fd, "note", 500) || null, validatedById: user.id, validatedAt: new Date(), paymentId: res.payment.id }).where(eq(s.historicalPayments.id, h.id));
      await logActivity(tx, { actorId: user.id, action: "historical_payment.validated", entityType: "historical_payment", entityId: h.id, applicationId: app.id, summary: `${user.name} validated previous payment ${h.reference} (${money(h.amount, h.currency)}, paid ${h.paidAt.toLocaleDateString("en-GB")}) against instalment ${i + 1} of ${app.reference}; receipt ${res.payment.receiptNumber}`, changes: { status: ["PENDING", "VALIDATED"] } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "DECIDED") return { error: "This payment has already been decided." };
    const msg = paymentError(e, h.reference);
    if (msg) return { error: msg.replace("balance still due on this invoice", `amount of instalment ${i + 1}`) };
    throw e;
  }
  refresh();
  return { ok: `Validated against instalment ${i + 1}. A receipt with the original date was issued.` };
}
