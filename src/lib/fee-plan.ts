import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDays, splitAmount, type Condition, type FeePlan, type Installment } from "./fees";
import { fromCents } from "./finance";
import { nextRef } from "./refs";
import { conditionMet, conditionOf, conditionText } from "./schedule";
import { logActivity, notify } from "./activity";
import { money } from "./format";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Rule = typeof s.feeRules.$inferSelect;

/** Default payment conditions when a fee rule doesn't say: first now, then after the offer letter, then after the visa. */
const defaultCondition = (i: number, n: number, service: string): Condition =>
  i === 0 ? "INITIAL" : service === "VISA" ? (i === n - 1 ? "VISA" : "STAGE:PROCESSING") : n === 2 || i === 1 ? "OFFER_LETTER" : "VISA";

/**
 * Locks the agreed price when the client applies: a draft schedule copied from the fee rule, with no invoices.
 * Finance or Admin confirm (and may adjust) the schedule at initial invoicing; only then is anything billed.
 */
export async function draftPlan(tx: Tx, app: { id: string; service: string }, rule: Rule, by: string, now = new Date()): Promise<FeePlan> {
  const inst = rule.installments as Installment[];
  const parts = splitAmount(Math.round(Number(rule.amount) * 100), inst.map((i) => i.percent));
  const plan: FeePlan = {
    ruleId: rule.id, ruleName: rule.name, amount: rule.amount, currency: rule.currency, appliedAt: now.toISOString(), appliedBy: by, confirmedAt: null, confirmedBy: null,
    installments: inst.map((x, i) => ({ label: x.label, amount: fromCents(parts[i]), dueDays: x.dueDays, condition: x.condition ?? defaultCondition(i, inst.length, app.service), loanEligible: false, historical: false, dueDate: null, invoiceId: null, invoiceNumber: null })),
  };
  await tx.update(s.applications).set({ feePlan: plan }).where(eq(s.applications.id, app.id));
  return plan;
}

/** What the activation rules need to know about an application right now. */
export async function scheduleContext(x: typeof db | Tx, appId: string) {
  const [app] = await x.select({ stage: s.applications.stage, service: s.applications.service, status: s.applications.status }).from(s.applications).where(eq(s.applications.id, appId));
  const files = await x.select({ kind: s.caseFiles.kind }).from(s.caseFiles).where(and(eq(s.caseFiles.applicationId, appId), inArray(s.caseFiles.kind, ["OFFER_LETTER", "VISA"])));
  return { ...app, offerLetter: files.some((f) => f.kind === "OFFER_LETTER"), visa: files.some((f) => f.kind === "VISA") };
}

/**
 * Issues the invoice of every instalment whose payment condition has now been reached (and not before).
 * Historical instalments (paid before the platform) are never invoiced here: Finance validates them instead.
 * Returns the newly invoiced rows. Call inside a transaction, after anything that could meet a condition.
 */
export async function activateDue(tx: Tx, appId: string, actorId: string | null) {
  // (actorId is null for automatic moves; the invoice is then attributed to whoever confirmed the schedule)
  await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, appId)).for("update");
  const [app] = await tx.select().from(s.applications).where(eq(s.applications.id, appId));
  const plan = app.feePlan as FeePlan | null;
  if (!plan?.confirmedAt || app.status !== "ACTIVE") return [];
  const ctx = await scheduleContext(tx, appId);
  const now = new Date();
  const made: { number: string; label: string; amount: string; dueDate: Date }[] = [];
  const n = plan.installments.length;
  for (const [i, r] of plan.installments.entries()) {
    if (r.invoiceId || r.historical || !conditionMet(conditionOf(r), ctx)) continue;
    const number = await nextRef(tx, "INV");
    const due = addDays(now, r.dueDays ?? 7);
    const [inv] = await tx.insert(s.invoices).values({ number, applicationId: appId, description: n > 1 ? `Instalment ${i + 1} of ${n}: ${r.label}` : r.label, amount: r.amount, currency: plan.currency, dueDate: due, status: "ISSUED", createdById: actorId ?? plan.confirmedById ?? app.clientId }).returning({ id: s.invoices.id });
    Object.assign(r, { invoiceId: inv.id, invoiceNumber: number, dueDate: due.toISOString(), activatedAt: now.toISOString() });
    made.push({ number, label: r.label, amount: r.amount, dueDate: due });
    await logActivity(tx, { actorId, action: "invoice.activated", entityType: "invoice", entityId: inv.id, applicationId: appId, summary: `Instalment ${i + 1} of ${app.reference} became payable (${conditionText(conditionOf(r), "staff").toLowerCase()}): invoice ${number}, ${money(r.amount, plan.currency)}`, changes: { instalment: [null, i + 1], invoice: [null, number] } });
    await notify(tx, { userId: app.clientId, title: n > 1 ? `Instalment ${i + 1} is now payable` : "Your invoice is ready", body: `${app.reference}: ${r.label}, ${money(r.amount, plan.currency)}, due ${due.toLocaleDateString("en-GB")}. Invoice ${number}.`, link: `/portal/applications/${appId}#invoices` });
  }
  if (made.length) await tx.update(s.applications).set({ feePlan: plan }).where(eq(s.applications.id, appId));
  return made;
}

export const allRules = () => db.select().from(s.feeRules);
