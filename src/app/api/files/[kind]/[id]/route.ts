import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewApplication, canViewDocuments } from "@/lib/permissions";
import { fileResponse } from "@/lib/file-response";

// Private files other than checklist documents: payment proofs, loan papers, contracts, refund forms,
// amendment attachments. Each kind has its own access rule, checked on every request.
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in required", { status: 401 });
  const { kind, id } = await ctx.params;
  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1";
  const nf = new Response("Not found", { status: 404 });
  const appCols = { columns: { id: true, clientId: true, consultantId: true, service: true } } as const;

  if (kind === "submission") {
    const x = await db.query.paymentSubmissions.findFirst({ where: eq(s.paymentSubmissions.id, id), with: { application: appCols } });
    const ok = x && (user.role === "FINANCE" || user.role === "ADMIN" || (user.role === "CLIENT" && x.application.clientId === user.id));
    if (!ok) return nf;
    const loan = url.searchParams.get("doc") === "loan";
    const key = loan ? x.loanDocKey : x.proofKey, name = loan ? x.loanDocName : x.proofName;
    if (!key || !name) return nf;
    return fileResponse(key, name, loan ? mimeOf(name) : x.proofMime ?? mimeOf(name), inline);
  }
  if (kind === "contract") {
    const c = await db.query.contracts.findFirst({ where: eq(s.contracts.id, id), with: { application: appCols } });
    if (!c || !(canViewDocuments(user, c.application) || user.role === "FINANCE")) return nf;
    return fileResponse(c.storageKey, c.fileName, c.mimeType, inline);
  }
  if (kind === "refund") {
    const r = await db.query.refundRequests.findFirst({ where: eq(s.refundRequests.id, id), with: { application: appCols } });
    if (!r?.formKey || !(canViewApplication(user, r.application))) return nf;
    return fileResponse(r.formKey, r.formName ?? "refund-form.pdf", mimeOf(r.formName ?? "x.pdf"), inline);
  }
  if (kind === "amendment") {
    const a = await db.query.amendmentRequests.findFirst({ where: eq(s.amendmentRequests.id, id), with: { application: appCols } });
    if (!a?.attachmentKey || !canViewApplication(user, a.application)) return nf;
    return fileResponse(a.attachmentKey, a.attachmentName ?? "attachment.pdf", mimeOf(a.attachmentName ?? "x.pdf"), inline);
  }
  return nf;
}

function mimeOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : ext === "doc" ? "application/msword" : "application/octet-stream";
}
