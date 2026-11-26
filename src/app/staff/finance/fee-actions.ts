"use server";
// Fee rules (Finance/Admin) and applying a fee plan to an application, which issues one invoice per instalment.
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { nextRef } from "@/lib/refs";
import { CURRENCIES, fromCents, parseAmount } from "@/lib/finance";
import { addDays, matchingRules, splitAmount, validateInstallments, type FeePlan, type Installment, type Scope } from "@/lib/fees";
import { scopeOf } from "@/lib/fee-scope";
import { money } from "@/lib/format";

export type FeeState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 200) => String(fd.get(k) ?? "").trim().slice(0, n);
const SERVICES = ["WORK", "STUDY", "VISA"] as const;
// Which narrowing fields make sense for each service.
const SCOPE_FIELDS: Record<(typeof SERVICES)[number], (keyof Scope)[]> = {
  WORK: ["countryId", "jobId"], STUDY: ["countryId", "universityId", "programId"], VISA: ["countryId", "visaCategoryId"],
};

export async function saveFeeRule(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const id = str(fd, "id", 64);
  const name = str(fd, "name", 120);
  const service = str(fd, "service", 10) as (typeof SERVICES)[number];
  const cents = parseAmount(str(fd, "amount", 30));
  const currency = str(fd, "currency", 3);
  if (name.length < 3) return { error: "Give the fee a name, e.g. \"Netherlands work placement\"." };
  if (!SERVICES.includes(service)) return { error: "Choose a service." };
  if (cents === null) return { error: "Enter the total service fee, e.g. 1500." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Choose a currency." };
  const installments: Installment[] = [];
  for (const i of [1, 2, 3]) {
    const label = str(fd, `label${i}`, 60), pct = str(fd, `percent${i}`, 5), days = str(fd, `dueDays${i}`, 5);
    if (!label && !pct) continue;
    installments.push({ label, percent: Number(pct), dueDays: days === "" ? 0 : Number(days) });
  }
  const bad = validateInstallments(installments);
  if (bad) return { error: bad };
  const scope: Record<string, string | null> = { countryId: null, jobId: null, universityId: null, programId: null, visaCategoryId: null };
  for (const f of SCOPE_FIELDS[service]) scope[f] = str(fd, f, 64) || null;
  // The chosen listing must belong to the chosen country, so a rule can't silently never match.
  if (scope.jobId && scope.countryId) {
    const j = await db.query.jobs.findFirst({ where: eq(s.jobs.id, scope.jobId), columns: { countryId: true } });
    if (j?.countryId !== scope.countryId) return { error: "That job is not in the chosen country." };
  }
  if ((scope.programId || scope.universityId) && scope.countryId) {
    const uniId = scope.universityId ?? (await db.query.programs.findFirst({ where: eq(s.programs.id, scope.programId!), columns: { universityId: true } }))?.universityId;
    const u = uniId ? await db.query.universities.findFirst({ where: eq(s.universities.id, uniId), columns: { countryId: true } }) : null;
    if (u?.countryId !== scope.countryId) return { error: "That university or program is not in the chosen country." };
  }
  if (scope.programId && scope.universityId) {
    const p = await db.query.programs.findFirst({ where: eq(s.programs.id, scope.programId), columns: { universityId: true } });
    if (p?.universityId !== scope.universityId) return { error: "That program is not at the chosen university." };
  }
  const values = { name, service, amount: fromCents(cents), currency, installments, ...scope };
  if (id) {
    const before = await db.query.feeRules.findFirst({ where: eq(s.feeRules.id, id) });
    if (!before) return { error: "This fee no longer exists." };
    const changes = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((before as Record<string, unknown>)[k])).map(([k, v]) => [k, [(before as Record<string, unknown>)[k], v]]));
    if (!Object.keys(changes).length) return { ok: "No changes to save." };
    await db.transaction(async (tx) => {
      await tx.update(s.feeRules).set(values).where(eq(s.feeRules.id, id));
      await logActivity(tx, { actorId: user.id, action: "fee.changed", entityType: "fee_rule", entityId: id, summary: `${user.name} changed fee "${name}"${changes.amount ? ` from ${money(before.amount, before.currency)} to ${money(values.amount, currency)}` : ""}`, changes });
    });
    revalidatePath("/staff/finance/fees");
    return { ok: "Saved. Applications that already have a fee plan keep their agreed price." };
  }
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(s.feeRules).values({ ...values, createdById: user.id }).returning({ id: s.feeRules.id });
    await logActivity(tx, { actorId: user.id, action: "fee.created", entityType: "fee_rule", entityId: r.id, summary: `${user.name} created fee "${name}" (${money(values.amount, currency)}, ${installments.length} instalment${installments.length === 1 ? "" : "s"})`, changes: { values: [null, values] } });
  });
  revalidatePath("/staff/finance/fees");
  return { ok: `Fee "${name}" created.` };
}

export async function toggleFeeRule(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const r = await db.query.feeRules.findFirst({ where: eq(s.feeRules.id, str(fd, "id", 64)) });
  if (!r) return { error: "This fee no longer exists." };
  await db.transaction(async (tx) => {
    await tx.update(s.feeRules).set({ active: !r.active }).where(eq(s.feeRules.id, r.id));
    await logActivity(tx, { actorId: user.id, action: r.active ? "fee.deactivated" : "fee.activated", entityType: "fee_rule", entityId: r.id, summary: `${user.name} ${r.active ? "stopped offering" : "started offering"} fee "${r.name}"`, changes: { active: [r.active, !r.active] } });
  });
  revalidatePath("/staff/finance/fees");
  return { ok: r.active ? `"${r.name}" is no longer offered for new fee plans.` : `"${r.name}" is offered again.` };
}

export async function applyFeePlan(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app) return { error: "Application not found." };
  if (app.feePlan) return { error: "This application already has a fee plan." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  const rule = await db.query.feeRules.findFirst({ where: eq(s.feeRules.id, str(fd, "ruleId", 64)) });
  if (!rule) return { error: "Choose a fee." };
  if (!matchingRules([rule], await scopeOf(app)).length) return { error: "That fee doesn't apply to this application." };
  const inst = rule.installments as Installment[];
  const parts = splitAmount(Math.round(Number(rule.amount) * 100), inst.map((i) => i.percent));
  const now = new Date();
  const plan = await db.transaction(async (tx) => {
    const rows: FeePlan["installments"] = [];
    for (const [i, x] of inst.entries()) {
      const number = await nextRef(tx, "INV");
      const due = addDays(now, x.dueDays);
      const [inv] = await tx.insert(s.invoices).values({ number, applicationId: app.id, description: inst.length > 1 ? `Instalment ${i + 1} of ${inst.length}: ${x.label}` : x.label, amount: fromCents(parts[i]), currency: rule.currency, dueDate: due, status: "ISSUED", createdById: user.id }).returning();
      rows.push({ label: x.label, amount: inv.amount, dueDate: due.toISOString(), invoiceId: inv.id, invoiceNumber: number });
    }
    const p: FeePlan = { ruleId: rule.id, ruleName: rule.name, amount: rule.amount, currency: rule.currency, appliedAt: now.toISOString(), appliedBy: user.name, installments: rows };
    await tx.update(s.applications).set({ feePlan: p }).where(eq(s.applications.id, app.id));
    await logActivity(tx, { actorId: user.id, action: "fee.applied", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${user.name} applied fee "${rule.name}" (${money(rule.amount, rule.currency)} in ${rows.length} instalment${rows.length === 1 ? "" : "s"}) to ${app.reference}` });
    await notify(tx, { userId: app.clientId, title: "Your service fee", body: `${app.reference}: ${money(rule.amount, rule.currency)} in ${rows.length} instalment${rows.length === 1 ? "" : "s"}. First due ${due0(rows)}.`, link: `/portal/applications/${app.id}` });
    return p;
  });
  await emailUser(app.clientId, `Service fee for ${app.reference}`, `Your service fee for application ${app.reference} is ${money(plan.amount, plan.currency)}, paid in ${plan.installments.length} instalment${plan.installments.length === 1 ? "" : "s"}:\n\n${plan.installments.map((x) => `${x.invoiceNumber}: ${x.label}, ${money(x.amount, plan.currency)}, due ${new Date(x.dueDate).toLocaleDateString("en-GB")}`).join("\n")}`, `/portal/applications/${app.id}`);
  for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`, "/staff/finance"]) revalidatePath(p);
  return { ok: `Fee plan applied: ${plan.installments.length} invoice${plan.installments.length === 1 ? "" : "s"} issued.` };
}
const due0 = (rows: FeePlan["installments"]) => new Date(rows[0].dueDate).toLocaleDateString("en-GB");

/** Removes a fee plan applied by mistake: only while none of its invoices has a payment. Its invoices are voided. */
export async function removeFeePlan(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  const plan = app?.feePlan as FeePlan | null | undefined;
  if (!app || !plan) return { error: "This application has no fee plan." };
  const reason = str(fd, "reason", 300);
  if (reason.length < 5) return { error: "Give a reason for removing the fee plan." };
  const ids = plan.installments.map((x) => x.invoiceId);
  const paid = await db.select({ id: s.payments.id }).from(s.payments).where(inArray(s.payments.invoiceId, ids)).limit(1);
  if (paid.length) return { error: "Payments have been recorded on this fee plan, so it can't be removed. Use a refund instead." };
  await db.transaction(async (tx) => {
    await tx.update(s.invoices).set({ status: "VOID" }).where(and(inArray(s.invoices.id, ids)));
    await tx.update(s.applications).set({ feePlan: null }).where(eq(s.applications.id, app.id));
    await logActivity(tx, { actorId: user.id, action: "fee.removed", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${user.name} removed fee plan "${plan.ruleName}" from ${app.reference}: ${reason}` });
    await notify(tx, { userId: app.clientId, title: "Fee plan cancelled", body: `${app.reference}: the previous invoices were cancelled. Finance will confirm the correct fee.`, link: `/portal/applications/${app.id}` });
  });
  for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`]) revalidatePath(p);
  return { ok: "Fee plan removed and its invoices voided." };
}
