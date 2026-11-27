import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDays, splitAmount, type FeePlan, type Installment } from "./fees";
import { fromCents } from "./finance";
import { nextRef } from "./refs";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Rule = typeof s.feeRules.$inferSelect;

/** Issues one invoice per instalment and stores the agreed plan on the application. Call inside a transaction. */
export async function applyPlan(tx: Tx, app: { id: string }, rule: Rule, actor: { id: string; name: string }, now = new Date()): Promise<FeePlan> {
  const inst = rule.installments as Installment[];
  const parts = splitAmount(Math.round(Number(rule.amount) * 100), inst.map((i) => i.percent));
  const rows: FeePlan["installments"] = [];
  for (const [i, x] of inst.entries()) {
    const number = await nextRef(tx, "INV");
    const due = addDays(now, x.dueDays);
    const [inv] = await tx.insert(s.invoices).values({ number, applicationId: app.id, description: inst.length > 1 ? `Instalment ${i + 1} of ${inst.length}: ${x.label}` : x.label, amount: fromCents(parts[i]), currency: rule.currency, dueDate: due, status: "ISSUED", createdById: actor.id }).returning();
    rows.push({ label: x.label, amount: inv.amount, dueDate: due.toISOString(), invoiceId: inv.id, invoiceNumber: number });
  }
  const plan: FeePlan = { ruleId: rule.id, ruleName: rule.name, amount: rule.amount, currency: rule.currency, appliedAt: now.toISOString(), appliedBy: actor.name, installments: rows };
  await tx.update(s.applications).set({ feePlan: plan }).where(eq(s.applications.id, app.id));
  return plan;
}

export const allRules = () => db.select().from(s.feeRules);
