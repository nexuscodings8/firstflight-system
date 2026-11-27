import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewDocuments } from "@/lib/permissions";
import { fileResponse } from "@/lib/file-response";
import { logActivity } from "@/lib/activity";

// Documents are never public: every request checks the signed-in user's right to this application.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.query.documents.findFirst({ where: eq(s.documents.id, id), with: { application: { columns: { id: true, clientId: true, consultantId: true, reference: true, service: true } } } });
  if (!doc || !canViewDocuments(user, doc.application)) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  if (user.id !== doc.application.clientId) {
    await logActivity(db, { actorId: user.id, action: inline ? "document.previewed" : "document.viewed", entityType: "document", entityId: doc.id, applicationId: doc.application.id, summary: `${user.name} ${inline ? "previewed" : "downloaded"} ${doc.fileName} (${doc.application.reference})` });
  }
  return fileResponse(doc.storageKey, doc.fileName, doc.mimeType, inline);
}
