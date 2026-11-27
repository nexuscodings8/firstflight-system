import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { planConfirmed, type FeePlan } from "./fees";
import { paymentFacts } from "./stage-rules";
import { conditionOf, gateOf, stageBlock, type GateFacts } from "./schedule";
import { activateDue, scheduleContext } from "./fee-plan";
import { logActivity, notify } from "./activity";
import { STAGE_LABEL } from "./format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Everything the stage gates look at: payments per instalment, contract, offer letter and visa. */
export async function factsFor(x: typeof db | Tx, appId: string) {
  const [app] = await x.select().from(s.applications).where(eq(s.applications.id, appId));
  const invs = await x.select({ id: s.invoices.id, status: s.invoices.status, createdAt: s.invoices.createdAt }).from(s.invoices).where(eq(s.invoices.applicationId, appId));
  const [signed] = await x.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.applicationId, appId), eq(s.contracts.kind, "CONTRACT"))).limit(1);
  const ctx = await scheduleContext(x, appId);
  const plan = app.feePlan as FeePlan | null;
  const legacy = paymentFacts(invs, plan?.installments[0]?.invoiceId ?? null);
  const byId = new Map(invs.map((i) => [i.id, i.status]));
  const rows = plan ? plan.installments.map((r) => ({ label: r.label, condition: conditionOf(r), invoiced: !!r.invoiceId, paid: !!r.invoiceId && byId.get(r.invoiceId) === "PAID" })) : null;
  const confirmed = planConfirmed(plan);
  const gate: GateFacts = { service: app.service, contractSigned: !!signed, offerLetter: ctx.offerLetter, visa: ctx.visa, rows, scheduleConfirmed: confirmed, legacyFirstPaid: legacy.firstPaid, legacyAllPaid: legacy.allPaid };
  const firstPaid = rows && confirmed ? rows[0]?.paid ?? false : rows ? false : legacy.firstPaid;
  return { ...gate, firstPaid, stage: app.stage, status: app.status, clientId: app.clientId, consultantId: app.consultantId, reference: app.reference, gate };
}

/**
 * Moves an application forward automatically when what it was waiting for has happened:
 * first instalment approved → Contract signing; contract signed → Processing; offer letter in and its instalment
 * approved → Visa processing; visa recorded and its instalment approved → Final collection.
 * After any move, instalments whose stage condition is now met are invoiced.
 */
export async function autoAdvance(tx: Tx, appId: string, actorId: string | null) {
  for (let guard = 0; guard < 4; guard++) {
    const f = await factsFor(tx, appId);
    if (f.status !== "ACTIVE") return;
    const can = (st: string) => !stageBlock(st, false, f.gate);
    const gated = (st: string) => !!f.rows?.some((r) => gateOf(r.condition) === st);
    let to: string | null = null, why = "";
    if (f.stage === "INITIAL_PAYMENT" && f.firstPaid) { to = f.contractSigned ? "PROCESSING" : "DOCUMENT_SIGNING"; why = "first instalment approved"; }
    else if (f.stage === "DOCUMENT_SIGNING" && f.contractSigned && can("PROCESSING")) { to = "PROCESSING"; why = "contract signed"; }
    else if (f.stage === "GETTING_OFFER" && f.offerLetter && gated("VISA_PROCESSING") && can("VISA_PROCESSING")) { to = "VISA_PROCESSING"; why = "offer letter received and its instalment approved"; }
    else if (f.stage === "VISA_PROCESSING" && f.visa && gated("FINAL_COLLECTION") && can("FINAL_COLLECTION")) { to = "FINAL_COLLECTION"; why = "visa recorded and its instalment approved"; }
    if (!to) break;
    await tx.update(s.applications).set({ stage: to as typeof s.applications.$inferInsert.stage }).where(eq(s.applications.id, appId));
    await logActivity(tx, { actorId, action: "application.auto_progress", entityType: "application", entityId: appId, applicationId: appId, summary: `${f.reference} moved automatically to ${STAGE_LABEL[to]} (${why})`, changes: { stage: [f.stage, to] } });
    const client = to === "DOCUMENT_SIGNING" ? ["Payment approved: sign your contract", `${f.reference}: your first instalment is approved. You can now sign your service contract online.`] : [`Your application moved to ${STAGE_LABEL[to]}`, `${f.reference}: ${why}.`];
    await notify(tx, { userId: f.clientId, title: client[0], body: client[1], link: `/portal/applications/${appId}` });
    if (f.consultantId) await notify(tx, { userId: f.consultantId, title: "Application moved on", body: `${f.reference} is now at ${STAGE_LABEL[to]} (${why}).`, link: `/staff/applications/${appId}` });
  }
  await activateDue(tx, appId, actorId);
}
