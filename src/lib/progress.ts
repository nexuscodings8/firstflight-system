import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { FeePlan } from "./fees";
import { paymentFacts, type Facts } from "./stage-rules";
import { logActivity, notify } from "./activity";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function factsFor(x: typeof db | Tx, appId: string): Promise<Facts & { stage: string; status: string; clientId: string; consultantId: string | null; reference: string }> {
  const [app] = await x.select().from(s.applications).where(eq(s.applications.id, appId));
  const invs = await x.select({ id: s.invoices.id, status: s.invoices.status, createdAt: s.invoices.createdAt }).from(s.invoices).where(eq(s.invoices.applicationId, appId));
  const [signed] = await x.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.applicationId, appId), eq(s.contracts.kind, "CONTRACT"))).limit(1);
  const plan = app.feePlan as FeePlan | null;
  return { ...paymentFacts(invs, plan?.installments[0]?.invoiceId ?? null), contractSigned: !!signed, stage: app.stage, status: app.status, clientId: app.clientId, consultantId: app.consultantId, reference: app.reference };
}

/**
 * Moves an application forward automatically when what it was waiting for has happened:
 * first instalment approved at Initial payment → Document signing; contract signed at Document signing → Processing.
 */
export async function autoAdvance(tx: Tx, appId: string, actorId: string | null) {
  const f = await factsFor(tx, appId);
  if (f.status !== "ACTIVE") return;
  let to: "DOCUMENT_SIGNING" | "PROCESSING" | null = null;
  if (f.stage === "INITIAL_PAYMENT" && f.firstPaid) to = f.contractSigned ? "PROCESSING" : "DOCUMENT_SIGNING";
  else if (f.stage === "DOCUMENT_SIGNING" && f.firstPaid && f.contractSigned) to = "PROCESSING";
  if (!to) return;
  await tx.update(s.applications).set({ stage: to }).where(eq(s.applications.id, appId));
  await logActivity(tx, { actorId, action: "application.auto_progress", entityType: "application", entityId: appId, applicationId: appId, summary: `${f.reference} moved automatically to ${to === "DOCUMENT_SIGNING" ? "Document signing (first instalment approved)" : "Processing (contract signed)"}`, changes: { stage: [f.stage, to] } });
  await notify(tx, { userId: f.clientId, title: to === "DOCUMENT_SIGNING" ? "Payment approved: sign your contract" : "Contract signed: processing started", body: to === "DOCUMENT_SIGNING" ? `${f.reference}: your first instalment is approved. You can now sign your service contract online.` : `${f.reference} is now being processed.`, link: `/portal/applications/${appId}` });
  if (f.consultantId) await notify(tx, { userId: f.consultantId, title: "Application moved on", body: `${f.reference} is now at ${to === "DOCUMENT_SIGNING" ? "Document signing" : "Processing"}.`, link: `/staff/applications/${appId}` });
}
