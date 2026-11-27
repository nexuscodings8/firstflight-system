"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { money } from "@/lib/format";

export type SendState = { ok?: string; error?: string } | undefined;

/** Finance sends an invoice or receipt to the client: a portal notification, an email (when connected) and a record. */
export async function sendToClient(_: SendState, fd: FormData): Promise<SendState> {
  const me = await requireUser(["FINANCE", "ADMIN"]);
  const kind = String(fd.get("kind")), id = String(fd.get("id") ?? "");
  if (kind === "invoice") {
    const inv = await db.query.invoices.findFirst({ where: eq(s.invoices.id, id), with: { application: { columns: { id: true, clientId: true, reference: true } } } });
    if (!inv || inv.status === "VOID") return { error: "Invoice not found or void." };
    await db.transaction(async (tx) => {
      await tx.update(s.invoices).set({ sentAt: new Date() }).where(eq(s.invoices.id, inv.id));
      await notify(tx, { userId: inv.application.clientId, title: `Invoice ${inv.number}`, body: `${inv.description}: ${money(inv.amount, inv.currency)}. Open it to view or download the PDF.`, link: `/billing/invoices/${inv.id}` });
      await logActivity(tx, { actorId: me.id, action: "invoice.sent", entityType: "invoice", entityId: inv.id, applicationId: inv.application.id, summary: `${me.name} sent ${inv.number} to the client` });
    });
    await emailUser(inv.application.clientId, `Invoice ${inv.number} from FIRST FLIGHT`, `${inv.description}\nAmount: ${money(inv.amount, inv.currency)}\nApplication: ${inv.application.reference}`, `/billing/invoices/${inv.id}`);
    revalidatePath(`/billing/invoices/${inv.id}`); revalidatePath(`/staff/applications/${inv.application.id}`);
    return { ok: `${inv.number} sent to the client.` };
  }
  if (kind === "receipt") {
    const p = await db.query.payments.findFirst({ where: eq(s.payments.id, id), with: { invoice: { with: { application: { columns: { id: true, clientId: true } } } } } });
    if (!p) return { error: "Receipt not found." };
    await db.transaction(async (tx) => {
      await tx.update(s.payments).set({ receiptSentAt: new Date() }).where(eq(s.payments.id, p.id));
      await notify(tx, { userId: p.invoice.application.clientId, title: `Receipt ${p.receiptNumber}`, body: `${money(p.amount, p.invoice.currency)} received for ${p.invoice.number}.`, link: `/billing/receipts/${p.id}` });
      await logActivity(tx, { actorId: me.id, action: "receipt.sent", entityType: "payment", entityId: p.id, applicationId: p.invoice.application.id, summary: `${me.name} sent receipt ${p.receiptNumber} to the client` });
    });
    await emailUser(p.invoice.application.clientId, `Receipt ${p.receiptNumber} from FIRST FLIGHT`, `We received ${money(p.amount, p.invoice.currency)} for invoice ${p.invoice.number}. Thank you.`, `/billing/receipts/${p.id}`);
    revalidatePath(`/billing/receipts/${p.id}`);
    return { ok: `Receipt ${p.receiptNumber} sent to the client.` };
  }
  return { error: "Unknown document." };
}
