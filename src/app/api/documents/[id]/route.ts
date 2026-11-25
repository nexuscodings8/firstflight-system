import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewDocuments } from "@/lib/permissions";
import { readStored } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

// Documents are never public: every download checks the signed-in user's right to this application.
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.query.documents.findFirst({ where: eq(s.documents.id, id), with: { application: { columns: { id: true, clientId: true, consultantId: true, reference: true } } } });
  if (!doc || !canViewDocuments(user, doc.application)) return new Response("Not found", { status: 404 });
  const body = await readStored(doc.storageKey);
  if (user.id !== doc.application.clientId) {
    await logActivity(db, { actorId: user.id, action: "document.viewed", entityType: "document", entityId: doc.id, applicationId: doc.application.id, summary: `${user.name} opened ${doc.fileName} (${doc.application.reference})` });
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
