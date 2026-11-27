"use server";
// Fee rules (Finance/Admin) and each application's instalment schedule (stage-based: invoiced when payable).
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity, notify } from "@/lib/activity";
import { emailUser } from "@/lib/email";
import { CURRENCIES, fromCents, parseAmount } from "@/lib/finance";
import { matchingRules, planConfirmed, validateInstallments, type Condition, type FeePlan, type Installment, type Scope } from "@/lib/fees";
import { MAX_INSTALMENTS, conditionOf, conditionText, validateSchedule, type DraftRow } from "@/lib/schedule";
import { scopeOf } from "@/lib/fee-scope";
import { activateDue, draftPlan } from "@/lib/fee-plan";
import { STAGES, STAGE_LABEL, money } from "@/lib/format";

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

type Row = DraftRow & { amount: string };
const readRows = (fd: FormData) => {
  const n = Math.min(Math.max(Number(str(fd, "count", 2)) || 0, 0), MAX_INSTALMENTS);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const cents = parseAmount(str(fd, `amount${i}`, 30)) ?? 0;
    rows.push({ label: str(fd, `label${i}`, 80), cents, amount: fromCents(cents), condition: (str(fd, `condition${i}`, 40) || "INITIAL") as Condition, dueDays: Number(str(fd, `dueDays${i}`, 4) || 7), loanEligible: fd.get(`loan${i}`) === "on", historical: fd.get(`historical${i}`) === "on" });
  }
  return rows;
};

/**
 * Finance or Admin confirms an application's instalment schedule at initial invoicing: amounts, when each one
 * becomes payable, and whether the final instalment may be paid by loan. Only instalments whose condition is
 * already met are invoiced (normally just the first). Later edits may change only instalments not yet invoiced.
 */
export async function confirmSchedule(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app) return { error: "Application not found." };
  if (app.status !== "ACTIVE") return { error: "This application is closed." };
  const existingClient = app.origin === "EXISTING";
  if (!existingClient && STAGES.indexOf(app.stage) < STAGES.indexOf("INITIAL_PAYMENT")) return { error: `The schedule is set at ${STAGE_LABEL.INITIAL_PAYMENT}. The consultant moves the application there after the eligibility review.` };
  const old = app.feePlan as FeePlan | null;
  const confirmed = planConfirmed(old);
  const currency = confirmed ? old!.currency : str(fd, "currency", 3);
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { error: "Choose a currency." };
  const totalCents = confirmed ? Math.round(Number(old!.amount) * 100) : parseAmount(str(fd, "total", 30)) ?? 0;
  const rows = readRows(fd);
  if (!existingClient && rows.some((r) => r.historical)) return { error: "Only existing clients registered from before the platform can have instalments paid before the platform." };
  const bad = validateSchedule(totalCents, rows, app.service);
  if (bad) return { error: bad };
  const reason = str(fd, "reason", 300);
  const priceChanged = !!old && Math.round(Number(old.amount) * 100) !== totalCents;
  if ((confirmed || priceChanged) && reason.length < 5) return { error: confirmed ? "Give the reason for changing the schedule; the client is told." : "The total differs from the price agreed when the client applied. Give the reason." };
  if (confirmed) {
    // Invoiced instalments can't be changed here, only those not yet billed.
    if (rows.length < old!.installments.filter((x) => x.invoiceId).length) return { error: "Instalments that are already invoiced can't be removed." };
    for (const [i, x] of old!.installments.entries()) {
      if (!x.invoiceId) continue;
      if (rows[i].cents !== Math.round(Number(x.amount) * 100) || rows[i].label !== x.label) return { error: `Instalment ${i + 1} is already invoiced (${x.invoiceNumber}); its name and amount can't change. Void the invoice first if it's wrong.` };
    }
  }
  const now = new Date();
  const plan: FeePlan = {
    ruleId: old?.ruleId ?? "finance", ruleName: old?.ruleName ?? "Set by Finance", amount: fromCents(totalCents), currency,
    appliedAt: old?.appliedAt ?? now.toISOString(), appliedBy: old?.appliedBy ?? user.name,
    confirmedAt: old?.confirmedAt ?? now.toISOString(), confirmedBy: old?.confirmedBy ?? user.name, confirmedById: old?.confirmedById ?? user.id,
    installments: rows.map((r, i) => {
      const was = old?.installments[i];
      const keep = confirmed && was?.invoiceId ? { invoiceId: was.invoiceId, invoiceNumber: was.invoiceNumber, dueDate: was.dueDate, activatedAt: was.activatedAt ?? null } : { invoiceId: null, invoiceNumber: null, dueDate: null, activatedAt: null };
      return { label: r.label, amount: r.amount, condition: r.condition, dueDays: r.dueDays, loanEligible: r.loanEligible, historical: r.historical, ...keep };
    }),
  };
  const made = await db.transaction(async (tx) => {
    await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.id, app.id)).for("update");
    const history = [...((app.feePlanHistory as FeePlan[] | null) ?? []), ...(confirmed && old ? [old] : [])];
    await tx.update(s.applications).set({ feePlan: plan, feePlanHistory: history }).where(eq(s.applications.id, app.id));
    const desc = plan.installments.map((x, i) => `${i + 1}. ${x.label} ${money(x.amount, currency)} (${x.historical ? "paid before the platform" : conditionText(conditionOf(x), "staff").toLowerCase()}${x.loanEligible ? ", loan allowed" : ""})`).join("; ");
    await logActivity(tx, { actorId: user.id, action: confirmed ? "fee.schedule_changed" : "fee.schedule_confirmed", entityType: "application", entityId: app.id, applicationId: app.id,
      summary: `${user.name} ${confirmed ? "changed" : "confirmed"} the instalment schedule of ${app.reference}: ${money(plan.amount, currency)} in ${rows.length}: ${desc}${reason ? `. Reason: ${reason}` : ""}`,
      changes: { schedule: [old?.installments.map((x) => [x.label, x.amount, x.condition ?? "INITIAL"]) ?? null, plan.installments.map((x) => [x.label, x.amount, x.condition])], ...(priceChanged ? { total: [old?.amount, plan.amount] } : {}) } });
    await notify(tx, { userId: app.clientId, title: confirmed ? "Your payment schedule changed" : "Your payment schedule", body: `${app.reference}: ${money(plan.amount, currency)} in ${rows.length} instalment${rows.length === 1 ? "" : "s"}. You're asked to pay each one only when it becomes payable.${reason ? ` ${reason}` : ""}`, link: `/portal/applications/${app.id}#invoices` });
    return activateDue(tx, app.id, user.id);
  });
  await emailUser(app.clientId, `Payment schedule for ${app.reference}`, `Your service fee for ${app.reference} is ${money(plan.amount, currency)}, in ${rows.length} instalment${rows.length === 1 ? "" : "s"}:\n\n${plan.installments.map((x, i) => `${i + 1}. ${x.label}: ${money(x.amount, currency)}, ${x.historical ? "already paid before the platform (being confirmed by Finance)" : conditionText(conditionOf(x)).toLowerCase()}`).join("\n")}${made.length ? `\n\nPayable now: ${made.map((m) => `${m.number} (${money(m.amount, currency)}, due ${m.dueDate.toLocaleDateString("en-GB")})`).join(", ")}.` : ""}${reason ? `\n\n${reason}` : ""}`, `/portal/applications/${app.id}`);
  for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`, "/staff/finance"]) revalidatePath(p);
  return { ok: `Schedule ${confirmed ? "updated" : "confirmed"}. ${made.length ? `Invoiced now: ${made.map((m) => m.number).join(", ")}.` : "Nothing is payable yet."} The other instalments are invoiced only when their condition is met.` };
}

/** Removes a fee plan set by mistake: only while no payment is recorded on it. Its invoices are voided. */
export async function removeFeePlan(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  const plan = app?.feePlan as FeePlan | null | undefined;
  if (!app || !plan) return { error: "This application has no fee plan." };
  const reason = str(fd, "reason", 300);
  if (reason.length < 5) return { error: "Give a reason for removing the fee plan." };
  const ids = plan.installments.map((x) => x.invoiceId).filter((x): x is string => !!x);
  const paid = ids.length ? await db.select({ id: s.payments.id }).from(s.payments).where(inArray(s.payments.invoiceId, ids)).limit(1) : [];
  if (paid.length) return { error: "Payments have been recorded on this fee plan, so it can't be removed. Use an amendment or a refund instead." };
  await db.transaction(async (tx) => {
    if (ids.length) await tx.update(s.invoices).set({ status: "VOID" }).where(and(inArray(s.invoices.id, ids)));
    await tx.update(s.applications).set({ feePlan: null, feePlanHistory: [...((app.feePlanHistory as FeePlan[] | null) ?? []), plan] }).where(eq(s.applications.id, app.id));
    await logActivity(tx, { actorId: user.id, action: "fee.removed", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${user.name} removed fee plan "${plan.ruleName}" from ${app.reference}: ${reason}` });
    await notify(tx, { userId: app.clientId, title: "Fee plan cancelled", body: `${app.reference}: any invoices under it were cancelled. Finance will confirm the correct fee.`, link: `/portal/applications/${app.id}` });
  });
  for (const p of [`/staff/applications/${app.id}`, `/portal/applications/${app.id}`]) revalidatePath(p);
  return { ok: "Fee plan removed and its invoices voided." };
}

/** Starts a draft from a fee rule when an application has no locked price (e.g. no rule existed when it was made). */
export async function startFromRule(_: FeeState, fd: FormData): Promise<FeeState> {
  const user = await requireUser(["FINANCE", "ADMIN"]);
  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, str(fd, "applicationId", 64)) });
  if (!app || app.feePlan) return { error: app ? "This application already has a fee plan." : "Application not found." };
  const rule = await db.query.feeRules.findFirst({ where: eq(s.feeRules.id, str(fd, "ruleId", 64)) });
  if (!rule || !matchingRules([rule], await scopeOf(app)).length) return { error: "That fee doesn't apply to this application." };
  await db.transaction(async (tx) => {
    await draftPlan(tx, app, rule, user.name);
    await logActivity(tx, { actorId: user.id, action: "fee.drafted", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${user.name} started a schedule for ${app.reference} from fee "${rule.name}" (${money(rule.amount, rule.currency)})` });
  });
  revalidatePath(`/staff/applications/${app.id}`);
  return { ok: `Draft from "${rule.name}". Review the instalments and confirm.` };
}
