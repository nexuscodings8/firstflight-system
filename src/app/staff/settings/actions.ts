"use server";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { SERVICES, getOffice, getRefundPolicy, saveSetting } from "@/lib/settings";
import { SERVICE_LABEL } from "@/lib/format";

export type SetState = { ok?: string; error?: string } | undefined;
const str = (fd: FormData, k: string, n = 500) => String(fd.get(k) ?? "").trim().slice(0, n);

export async function saveOffice(_: SetState, fd: FormData): Promise<SetState> {
  const me = await requireUser(["ADMIN"]);
  const v = { address: str(fd, "address", 300), mapsUrl: str(fd, "mapsUrl", 500), phone: str(fd, "phone", 40), hours: str(fd, "hours", 120), confirmed: true };
  if (v.address.length < 8) return { error: "Enter the full office address." };
  if (!/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+)/i.test(v.mapsUrl)) return { error: "Paste a Google Maps link (from Share → Copy link in Google Maps)." };
  const before = await getOffice();
  await saveSetting("office", v, me.id);
  await logActivity(db, { actorId: me.id, action: "settings.office", entityType: "settings", entityId: "office", summary: `${me.name} updated the office details`, changes: { office: [before, v] } });
  revalidatePath("/staff/settings");
  return { ok: "Office details saved. New appointment invitations use them." };
}

export async function saveRefundPolicy(_: SetState, fd: FormData): Promise<SetState> {
  const me = await requireUser(["ADMIN", "FINANCE"]);
  const service = str(fd, "service", 10);
  if (!(SERVICES as readonly string[]).includes(service)) return { error: "Unknown service." };
  const after = Number(str(fd, "eligibleAfterDays", 5)), win = Number(str(fd, "windowDays", 5));
  if (!Number.isInteger(after) || after < 0 || after > 730) return { error: "Days before refunds open must be a whole number from 0 to 730." };
  if (!Number.isInteger(win) || win < 0 || win > 1825) return { error: "Days refunds stay open must be a whole number from 0 (no end) to 1825." };
  const v = { eligibleAfterDays: after, windowDays: win, allowReapplication: fd.get("allowReapplication") === "on", terms: str(fd, "terms", 1500) || "Refunds follow the terms of your signed service contract." };
  const before = await getRefundPolicy(service);
  await saveSetting(`refund_policy:${service}`, v, me.id);
  await logActivity(db, { actorId: me.id, action: "settings.refund_policy", entityType: "settings", entityId: `refund_policy:${service}`, summary: `${me.name} changed the ${SERVICE_LABEL[service]} refund policy (opens after ${after} days, open for ${win || "unlimited"} days)`, changes: { policy: [before, v] } });
  revalidatePath("/staff/settings");
  return { ok: `${SERVICE_LABEL[service]} refund policy saved.` };
}

/** Saving a contract creates a new version; contracts already signed keep the exact text the client saw. */
export async function saveContractTemplate(_: SetState, fd: FormData): Promise<SetState> {
  const me = await requireUser(["ADMIN"]);
  const service = str(fd, "service", 10);
  if (!(SERVICES as readonly string[]).includes(service)) return { error: "Unknown service." };
  const title = str(fd, "title", 150), body = String(fd.get("body") ?? "").trim().slice(0, 40000);
  if (title.length < 3 || body.length < 100) return { error: "Enter a title and the full contract text." };
  const [last] = await db.select().from(s.contractTemplates).where(eq(s.contractTemplates.service, service)).orderBy(desc(s.contractTemplates.version)).limit(1);
  if (last && last.title === title && last.body === body) return { ok: "No changes to save." };
  const version = (last?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.update(s.contractTemplates).set({ active: false }).where(and(eq(s.contractTemplates.service, service), eq(s.contractTemplates.active, true)));
    await tx.insert(s.contractTemplates).values({ service, version, title, body, createdById: me.id });
    await logActivity(tx, { actorId: me.id, action: "settings.contract", entityType: "contract_template", entityId: `${service}:${version}`, summary: `${me.name} published version ${version} of the ${SERVICE_LABEL[service]} contract` });
  });
  revalidatePath("/staff/settings");
  return { ok: `Version ${version} saved. New contracts use it; signed ones keep their version.` };
}
