import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { resolveSelection } from "./selection";
import { nextRef } from "./refs";
import { SERVICE_PREFIX } from "./ref-format";
import { logActivity, notify } from "./activity";
import { matchingRules } from "./fees";
import { scopeOf } from "./fee-scope";
import { draftPlan, allRules } from "./fee-plan";
import { money } from "./format";
import { assignInTx } from "./assignment";

type Selection = NonNullable<Awaited<ReturnType<typeof resolveSelection>>>;

/** The client's application that is still in progress, if any: a client may only have one at a time. */
export const activeApplication = (clientId: string) =>
  db.query.applications.findFirst({ where: and(eq(s.applications.clientId, clientId), eq(s.applications.status, "ACTIVE")), columns: { id: true, reference: true } });

/** Consultants allowed to handle a service, for "new client available" notices. */
export const consultantsFor = (service: string) =>
  db.select({ id: s.users.id }).from(s.users).innerJoin(s.consultantServices, eq(s.consultantServices.userId, s.users.id))
    .where(and(eq(s.users.role, "CONSULTANT"), eq(s.users.active, true), eq(s.consultantServices.service, service)));

/**
 * Creates an application for a client (from the website or by a consultant at the office).
 * Enforces one active application per client inside the transaction, attaches the listing's checklist,
 * and applies the matching service fee so the agreed price and instalments are fixed from the start.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function createApplication(opts: {
  client: { id: string; name: string }; sel: Selection; note: string | null; actor: { id: string; name: string }; via: "client" | "staff";
  /** Assign this consultant straight away (a consultant registering a client serves them). */ assignTo?: { id: string; name: string; self: boolean };
  /** Extra work in the same transaction, e.g. recording an existing client's history. Throw to cancel everything. */ afterCreate?: (tx: Tx, app: typeof s.applications.$inferSelect) => Promise<void>;
}) {
  const { client, sel, actor } = opts;
  const scope = await scopeOf({ service: sel.service, jobId: sel.jobId ?? null, programId: sel.programId ?? null, visaGuidanceId: sel.visaGuidanceId ?? null });
  const rule = matchingRules(await allRules(), scope)[0];
  const reapply = await db.query.refundRequests.findFirst({
    where: and(eq(s.refundRequests.clientId, client.id), eq(s.refundRequests.kind, "REAPPLICATION"), eq(s.refundRequests.reapplyMode, "NEW"), inArray(s.refundRequests.state, ["APPROVED", "COMPLETED"])),
    orderBy: [desc(s.refundRequests.createdAt)], columns: { applicationId: true },
  });
  const result = await db.transaction(async (tx) => {
    // Lock the client so two submissions at the same moment can't both pass the one-active check.
    await tx.execute(sql`select id from users where id = ${client.id} for update`);
    const [open] = await tx.select({ id: s.applications.id, reference: s.applications.reference }).from(s.applications).where(and(eq(s.applications.clientId, client.id), eq(s.applications.status, "ACTIVE"))).limit(1);
    if (open) return { existing: open };
    let previous: string | null = null;
    if (reapply) {
      const [used] = await tx.select({ id: s.applications.id }).from(s.applications).where(eq(s.applications.previousApplicationId, reapply.applicationId)).limit(1);
      if (!used) previous = reapply.applicationId;
    }
    const reference = await nextRef(tx, SERVICE_PREFIX[sel.service]);
    const [a] = await tx.insert(s.applications).values({
      reference, service: sel.service, clientId: client.id, jobId: sel.jobId, programId: sel.programId, visaGuidanceId: sel.visaGuidanceId, previousApplicationId: previous,
      selection: { title: sel.title, details: sel.details, visa: sel.visa ?? null, submittedAt: new Date().toISOString() }, clientNote: opts.note,
    }).returning();
    if (sel.checklist.length) await tx.insert(s.checklistItems).values(sel.checklist.map((c, i) => ({ applicationId: a.id, label: c.label, mandatory: c.mandatory, sortOrder: i })));
    const plan = rule ? await draftPlan(tx, { id: a.id, service: a.service }, rule, "Agreed at application") : null;
    await logActivity(tx, { actorId: actor.id, action: "application.submitted", entityType: "application", entityId: a.id, applicationId: a.id,
      summary: opts.via === "client" ? `${client.name} submitted ${reference}: ${sel.title}` : `${actor.name} created ${reference} for ${client.name}: ${sel.title}` });
    if (plan) await logActivity(tx, { actorId: actor.id, action: "fee.applied", entityType: "application", entityId: a.id, applicationId: a.id, summary: `Fee "${plan.ruleName}" (${money(plan.amount, plan.currency)} in ${plan.installments.length} instalment${plan.installments.length === 1 ? "" : "s"}) locked in for ${reference}; Finance confirms the instalment schedule at initial invoicing` });
    if (opts.assignTo) {
      await assignInTx(tx, a, opts.assignTo, actor, opts.assignTo.self ? "SELF_ASSIGNED" : "ASSIGNED", opts.assignTo.self ? "Registered this client" : null);
    } else {
      await notify(tx, { role: "ADMIN", title: "New application to assign", body: `${reference}: ${sel.title} from ${client.name}`, link: `/staff/assignments` });
      for (const k of await consultantsFor(sel.service)) await notify(tx, { userId: k.id, title: "New client available", body: `${reference}: ${sel.title}. Assign them to yourself under Available clients.`, link: "/staff/available" });
    }
    if (opts.afterCreate) await opts.afterCreate(tx, a);
    await notify(tx, { userId: client.id, title: "Application received", body: `We received ${reference} (${sel.title}).${opts.assignTo ? "" : " A consultant will be assigned shortly."}`, link: `/portal/applications/${a.id}` });
    return { created: a };
  });
  return result;
}

export const unassignedWhere = and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE"));
