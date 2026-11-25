"use server";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { resolveSelection, SELECTION_KEYS } from "@/lib/selection";
import { nextRef } from "@/lib/refs";
import { SERVICE_PREFIX } from "@/lib/ref-format";
import { logActivity, notify } from "@/lib/activity";

export type ApplyState = { error?: string } | undefined;

export async function submitApplication(_: ApplyState, fd: FormData): Promise<ApplyState> {
  const user = await requireUser(["CLIENT"]);
  const q = Object.fromEntries(SELECTION_KEYS.map((k) => [k, fd.get(k) ? String(fd.get(k)) : undefined]));
  const sel = await resolveSelection(q);
  if (!sel) return { error: "This listing is no longer available." };
  if (!sel.open) return { error: "This listing is not accepting applications right now." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000) || null;

  // One active application per listing per client.
  const listing = sel.jobId ? eq(s.applications.jobId, sel.jobId) : sel.programId ? eq(s.applications.programId, sel.programId) : eq(s.applications.visaGuidanceId, sel.visaGuidanceId!);
  const dup = await db.query.applications.findFirst({ where: and(eq(s.applications.clientId, user.id), listing, inArray(s.applications.status, ["ACTIVE"])), columns: { id: true } });
  if (dup) redirect(`/portal/applications/${dup.id}?existing=1`);

  const app = await db.transaction(async (tx) => {
    const reference = await nextRef(tx, SERVICE_PREFIX[sel.service]);
    const [a] = await tx.insert(s.applications).values({
      reference, service: sel.service, clientId: user.id, jobId: sel.jobId, programId: sel.programId, visaGuidanceId: sel.visaGuidanceId,
      selection: { title: sel.title, details: sel.details, visa: sel.visa ?? null, submittedAt: new Date().toISOString() }, clientNote: note,
    }).returning();
    if (sel.checklist.length) {
      await tx.insert(s.checklistItems).values(sel.checklist.map((c, i) => ({ applicationId: a.id, label: c.label, mandatory: c.mandatory, sortOrder: i })));
    }
    await logActivity(tx, { actorId: user.id, action: "application.submitted", entityType: "application", entityId: a.id, applicationId: a.id, summary: `${user.name} submitted ${reference}: ${sel.title}` });
    await notify(tx, { role: "ADMIN", title: "New application to assign", body: `${reference}: ${sel.title} from ${user.name}`, link: `/staff/applications/${a.id}` });
    await notify(tx, { userId: user.id, title: "Application received", body: `We received ${reference} (${sel.title}). A consultant will be assigned shortly.`, link: `/portal/applications/${a.id}` });
    return a;
  });
  redirect(`/portal/applications/${app.id}?submitted=1`);
}
