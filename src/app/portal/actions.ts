"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { canUploadToApplication } from "@/lib/permissions";
import { ALLOWED, MAX_BYTES, saveFile } from "@/lib/storage";
import { logActivity, notify } from "@/lib/activity";

export type UploadState = { ok?: string; error?: string } | undefined;

export async function uploadDocument(_: UploadState, fd: FormData): Promise<UploadState> {
  const user = await requireUser();
  const appId = String(fd.get("applicationId") ?? "");
  const itemId = String(fd.get("checklistItemId") ?? "");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "Files must be 10 MB or smaller." };
  if (!ALLOWED[file.type]) return { error: "Upload a PDF, JPG, PNG or Word document." };

  const app = await db.query.applications.findFirst({ where: eq(s.applications.id, appId), columns: { id: true, reference: true, clientId: true, consultantId: true, status: true } });
  if (!app || !canUploadToApplication(user, app)) return { error: "You can't upload to this application." };
  const item = await db.query.checklistItems.findFirst({ where: and(eq(s.checklistItems.id, itemId), eq(s.checklistItems.applicationId, app.id)) });
  if (!item) return { error: "That checklist item no longer exists." };

  const key = await saveFile(file);
  await db.transaction(async (tx) => {
    await tx.insert(s.documents).values({ applicationId: app.id, checklistItemId: item.id, uploadedById: user.id, fileName: file.name.slice(0, 200), mimeType: file.type, size: file.size, storageKey: key });
    await tx.update(s.checklistItems).set({ state: "UPLOADED" }).where(eq(s.checklistItems.id, item.id));
    await logActivity(tx, { actorId: user.id, action: "document.uploaded", entityType: "checklist_item", entityId: item.id, applicationId: app.id, summary: `${user.name} uploaded "${item.label}" to ${app.reference}`, changes: { state: [item.state, "UPLOADED"] } });
    // Tell whoever acts next: the assigned consultant, or admins if nobody is assigned yet.
    if (app.consultantId) await notify(tx, { userId: app.consultantId, title: "Document uploaded", body: `${item.label} for ${app.reference}`, link: `/staff/applications/${app.id}` });
    else await notify(tx, { role: "ADMIN", title: "Document uploaded (unassigned)", body: `${item.label} for ${app.reference}`, link: `/staff/applications/${app.id}` });
  });
  revalidatePath(`/portal/applications/${app.id}`);
  return { ok: `${file.name} uploaded.` };
}
