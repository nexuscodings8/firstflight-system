"use server";
// Content Manager writes. Every action: checks the role on the server, validates against the entity definition,
// saves, and records who changed what in the activity history.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, lt, desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { slugify } from "@/lib/slug";
import { getEntity, type Entity } from "@/lib/content/entities";
import { parseFields, uniqueSlug } from "@/lib/content/fields";
import { badRef, cols, getRow, tableOf, takenSlugs } from "@/lib/content/store";

export type ContentState = { ok?: string; error?: string } | undefined;
const CONTENT_ROLES = ["CONTENT_MANAGER", "ADMIN"] as const;
const str = (fd: FormData, k: string, n = 200) => String(fd.get(k) ?? "").trim().slice(0, n);

function friendly(e: unknown, entity: Entity) {
  const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
  if (code === "23505") return entity.key === "countries" ? "That country already exists in the catalogue." : `A ${entity.singular} with this name already exists.`;
  if (code === "23503") return `This ${entity.singular} is still used elsewhere (for example by listings or applications). Archive it instead.`;
  return null;
}

/** Extra rules that span several fields. */
function crossCheck(entity: Entity, v: Record<string, unknown>) {
  if (entity.key === "jobs" && v.salaryMin && v.salaryMax && Number(v.salaryMin) > Number(v.salaryMax)) return "Salary from can't be more than salary to.";
  if (entity.key === "promotions" && v.startsAt && v.expiresAt && +(v.expiresAt as Date) <= +(v.startsAt as Date)) return "The end date must be after the start date.";
  if (entity.key === "visa-guidance" && v.lastCheckedAt && +(v.lastCheckedAt as Date) > Date.now() + 86_400_000) return "The last-checked date can't be in the future.";
  return null;
}

export async function saveEntity(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const entity = getEntity(str(fd, "entity", 40));
  if (!entity) return { error: "Unknown content type." };
  const id = str(fd, "id", 64);
  const parsed = parseFields(entity.fields, (n) => (fd.get(n) === null ? null : String(fd.get(n))), (n) => fd.get(n) === "on");
  if (parsed.error !== undefined) return { error: parsed.error };
  const v: Record<string, unknown> = parsed.values;
  const cross = crossCheck(entity, v);
  if (cross) return { error: cross };
  const bad = await badRef(entity, v);
  if (bad) return { error: `Choose a valid ${bad.toLowerCase()}.` };
  if (entity.key === "visa-guidance") v.updatedById = user.id;
  const title = String(v[entity.titleField]);
  const t = tableOf(entity), c = cols(entity);
  try {
    if (id) {
      const before = await getRow(entity, id);
      if (!before) return { error: "This record no longer exists." };
      let note = "";
      if (entity.key === "testimonials" && before.status === "PUBLISHED" && !v.consentGiven) { v.status = "DRAFT"; note = " It was unpublished because consent is no longer recorded."; }
      const changed = Object.keys(v).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(v[k] ?? null) && k !== "updatedById");
      if (!changed.length) return { ok: "No changes to save." };
      await db.transaction(async (tx) => {
        await tx.update(t).set(v).where(eq(c.id, id));
        await logActivity(tx, { actorId: user.id, action: "content.updated", entityType: entity.key, entityId: id, summary: `${user.name} edited ${entity.singular} "${title}" (${changed.length} field${changed.length === 1 ? "" : "s"})`, changes: Object.fromEntries(changed.map((k) => [k, [before[k] ?? null, v[k] ?? null]])) });
      });
      revalidatePath(`/staff/content/${entity.key}`);
      return { ok: `Saved.${note}` };
    }
    if (entity.slugFrom) {
      const base = slugify(String(v[entity.slugFrom])).slice(0, 70);
      v.slug = uniqueSlug(base, await takenSlugs(entity, base));
    }
    if (entity.hasStatus) v.status = "DRAFT";
    const newId = await db.transaction(async (tx) => {
      const [row] = (await tx.insert(t).values(v).returning({ id: c.id })) as { id: string }[];
      await logActivity(tx, { actorId: user.id, action: "content.created", entityType: entity.key, entityId: row.id, summary: `${user.name} created ${entity.singular} "${title}"${entity.hasStatus ? " as a draft" : ""}` });
      return row.id;
    });
    revalidatePath(`/staff/content/${entity.key}`);
    redirect(`/staff/content/${entity.key}/${newId}?created=1`);
  } catch (e) {
    const msg = friendly(e, entity);
    if (msg) return { error: msg };
    throw e;
  }
}

const STATUS_WORD = { DRAFT: "moved back to draft", PUBLISHED: "published", ARCHIVED: "archived" } as const;

export async function setStatus(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const entity = getEntity(str(fd, "entity", 40));
  if (!entity?.hasStatus) return { error: "This content has no publishing status." };
  const status = str(fd, "status", 20) as keyof typeof STATUS_WORD;
  if (!(status in STATUS_WORD)) return { error: "Unknown status." };
  const row = await getRow(entity, str(fd, "id", 64));
  if (!row) return { error: "This record no longer exists." };
  if (row.status === status) return { ok: `Already ${STATUS_WORD[status]}.` };
  const extra: Record<string, unknown> = {};
  if (status === "PUBLISHED") {
    if (entity.key === "testimonials" && !row.consentGiven) return { error: "Record the client's written consent before publishing this testimonial." };
    if (entity.key === "news" && !row.publishedAt) extra.publishedAt = new Date();
    if (entity.key === "promotions" && +(row.expiresAt as Date) < Date.now()) return { error: "This promotion has already ended. Change its dates first." };
    if (entity.requirements && entity.key !== "visa-guidance") {
      const [anyReq] = await db.select({ id: s.requirementItems.id }).from(s.requirementItems).where(eq(s.requirementItems[entity.requirements], row.id)).limit(1);
      if (!anyReq) return { error: "Add at least one document to the checklist before publishing, so applicants know what to upload." };
    }
  }
  const title = String(row[entity.titleField]);
  await db.transaction(async (tx) => {
    await tx.update(tableOf(entity)).set({ status, ...extra }).where(eq(cols(entity).id, row.id));
    await logActivity(tx, { actorId: user.id, action: `content.${status.toLowerCase()}`, entityType: entity.key, entityId: row.id, summary: `${user.name} ${STATUS_WORD[status]} ${entity.singular} "${title}"`, changes: { status: [row.status, status] } });
  });
  revalidatePath(`/staff/content/${entity.key}/${row.id}`);
  return { ok: `${title} ${STATUS_WORD[status]}.` };
}

/** Deletes a record that was never published and isn't used anywhere; everything else is archived instead. */
export async function deleteEntity(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const entity = getEntity(str(fd, "entity", 40));
  if (!entity) return { error: "Unknown content type." };
  const row = await getRow(entity, str(fd, "id", 64));
  if (!row) return { error: "This record no longer exists." };
  if (entity.hasStatus && row.status !== "DRAFT") return { error: "Only drafts can be deleted. Archive it instead, so its history is kept." };
  const title = String(row[entity.titleField]);
  try {
    await db.transaction(async (tx) => {
      await tx.delete(tableOf(entity)).where(eq(cols(entity).id, row.id));
      await logActivity(tx, { actorId: user.id, action: "content.deleted", entityType: entity.key, entityId: row.id, summary: `${user.name} deleted ${entity.singular} "${title}"` });
    });
  } catch (e) {
    const msg = friendly(e, entity);
    if (msg) return { error: msg };
    throw e;
  }
  redirect(`/staff/content/${entity.key}?deleted=${encodeURIComponent(title)}`);
}

// ---------- document checklists (jobs, programs, visa guidance) ----------

async function ownerOf(fd: FormData) {
  const entity = getEntity(str(fd, "entity", 40));
  if (!entity?.requirements) return null;
  const row = await getRow(entity, str(fd, "id", 64));
  return row ? { entity, row, col: entity.requirements } : null;
}

export async function addRequirement(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const o = await ownerOf(fd);
  if (!o) return { error: "This record no longer exists." };
  const label = str(fd, "label", 150), note = str(fd, "note", 300);
  if (label.length < 2) return { error: "Name the document." };
  const [last] = await db.select({ n: s.requirementItems.sortOrder }).from(s.requirementItems).where(eq(s.requirementItems[o.col], o.row.id)).orderBy(desc(s.requirementItems.sortOrder)).limit(1);
  await db.transaction(async (tx) => {
    await tx.insert(s.requirementItems).values({ label, note: note || null, mandatory: fd.get("mandatory") === "on", sortOrder: (last?.n ?? 0) + 1, [o.col]: o.row.id });
    await logActivity(tx, { actorId: user.id, action: "content.checklist", entityType: o.entity.key, entityId: o.row.id, summary: `${user.name} added "${label}" to the checklist of "${String(o.row[o.entity.titleField])}"` });
  });
  revalidatePath(`/staff/content/${o.entity.key}/${o.row.id}`);
  return { ok: `Added "${label}".` };
}

export async function changeRequirement(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const o = await ownerOf(fd);
  if (!o) return { error: "This record no longer exists." };
  const item = await db.query.requirementItems.findFirst({ where: and(eq(s.requirementItems.id, str(fd, "itemId", 64)), eq(s.requirementItems[o.col], o.row.id)) });
  if (!item) return { error: "That checklist item no longer exists." };
  const op = str(fd, "op", 10);
  const where = `"${String(o.row[o.entity.titleField])}"`;
  if (op === "remove") {
    await db.transaction(async (tx) => {
      await tx.delete(s.requirementItems).where(eq(s.requirementItems.id, item.id));
      await logActivity(tx, { actorId: user.id, action: "content.checklist", entityType: o.entity.key, entityId: o.row.id, summary: `${user.name} removed "${item.label}" from the checklist of ${where}` });
    });
  } else if (op === "up" || op === "down") {
    const owner = eq(s.requirementItems[o.col], o.row.id);
    const [swap] = await db.select().from(s.requirementItems)
      .where(and(owner, op === "up" ? lt(s.requirementItems.sortOrder, item.sortOrder) : gt(s.requirementItems.sortOrder, item.sortOrder)))
      .orderBy(op === "up" ? desc(s.requirementItems.sortOrder) : asc(s.requirementItems.sortOrder)).limit(1);
    if (!swap) return { ok: "Already at the " + (op === "up" ? "top." : "bottom.") };
    await db.transaction(async (tx) => {
      await tx.update(s.requirementItems).set({ sortOrder: swap.sortOrder }).where(eq(s.requirementItems.id, item.id));
      await tx.update(s.requirementItems).set({ sortOrder: item.sortOrder }).where(eq(s.requirementItems.id, swap.id));
    });
  } else if (op === "toggle") {
    await db.update(s.requirementItems).set({ mandatory: !item.mandatory }).where(eq(s.requirementItems.id, item.id));
  } else return { error: "Unknown change." };
  revalidatePath(`/staff/content/${o.entity.key}/${o.row.id}`);
  return { ok: "Checklist updated." };
}

// ---------- visa guidance review ----------

/** Confirms an entry still matches its official source today, or flags it so visitors get a consultation instead. */
export async function reviewGuidance(_: ContentState, fd: FormData): Promise<ContentState> {
  const user = await requireUser([...CONTENT_ROLES]);
  const g = await db.query.visaGuidance.findFirst({ where: eq(s.visaGuidance.id, str(fd, "id", 64)) });
  if (!g) return { error: "This entry no longer exists." };
  const op = str(fd, "op", 10);
  if (op === "checked") {
    if (fd.get("confirm") !== "on") return { error: `Tick the box to confirm you compared it with ${g.sourceName} today.` };
    await db.transaction(async (tx) => {
      await tx.update(s.visaGuidance).set({ lastCheckedAt: new Date(), reviewState: "CURRENT", updatedById: user.id }).where(eq(s.visaGuidance.id, g.id));
      await logActivity(tx, { actorId: user.id, action: "content.visa_checked", entityType: "visa-guidance", entityId: g.id, summary: `${user.name} checked "${g.title}" against ${g.sourceName}`, changes: { reviewState: [g.reviewState, "CURRENT"] } });
    });
  } else if (op === "flag") {
    await db.transaction(async (tx) => {
      await tx.update(s.visaGuidance).set({ reviewState: "NEEDS_REVIEW", updatedById: user.id }).where(eq(s.visaGuidance.id, g.id));
      await logActivity(tx, { actorId: user.id, action: "content.visa_flagged", entityType: "visa-guidance", entityId: g.id, summary: `${user.name} flagged "${g.title}" for review` });
    });
  } else return { error: "Unknown action." };
  revalidatePath("/staff/content/visa-review");
  revalidatePath(`/staff/content/visa-guidance/${g.id}`);
  return { ok: op === "checked" ? `"${g.title}" marked as checked today.` : `"${g.title}" flagged. Visitors will be offered a consultation until it is checked.` };
}
