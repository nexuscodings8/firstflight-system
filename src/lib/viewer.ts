import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { CurrentUser } from "./auth";
import { canViewApplication, canViewDocuments, canWorkOnCase } from "./permissions";
import { PAYMENT_METHOD_LABEL } from "./finance";
import { dateTime, money } from "./format";
import { FINAL_CATEGORIES } from "./final-collection";

export type Viewable = {
  title: string; fileName: string; mime: string; src: string; download: string; back: { href: string; label: string };
  meta: [string, string][]; review?: { applicationId: string; itemId: string; label: string };
};

const mimeOf = (name: string) => { const e = name.split(".").pop()?.toLowerCase(); return e === "pdf" ? "application/pdf" : e === "png" ? "image/png" : e === "jpg" || e === "jpeg" ? "image/jpeg" : "application/octet-stream"; };
const appCols = { columns: { id: true, clientId: true, consultantId: true, service: true, reference: true } } as const;

/** Loads a private file's details for the viewer, or null when this user may not see it (same rules as the file routes). */
export async function loadViewable(user: CurrentUser, kind: string, id: string): Promise<Viewable | null> {
  const area = user.role === "CLIENT" ? "portal" : "staff";
  const appBack = (appId: string, ref: string) => ({ href: `/${area}/applications/${appId}`, label: `Back to ${ref}` });
  if (kind === "document") {
    const d = await db.query.documents.findFirst({ where: eq(s.documents.id, id), with: { application: appCols, checklistItem: { with: { reviewedBy: { columns: { name: true } } } } } });
    if (!d || !canViewDocuments(user, d.application)) return null;
    const c = d.checklistItem;
    const latest = c ? await db.query.documents.findFirst({ where: eq(s.documents.checklistItemId, c.id), orderBy: (x, { desc }) => [desc(x.createdAt)], columns: { id: true } }) : null;
    const isLatest = latest?.id === d.id;
    const meta: [string, string][] = [["Application", d.application.reference], ["Uploaded", dateTime(d.createdAt)]];
    if (c) meta.push(["Checklist item", c.label], ["Status", c.state === "UPLOADED" ? "Waiting for review" : c.state.charAt(0) + c.state.slice(1).toLowerCase()]);
    if (c?.reviewedAt) meta.push(["Reviewed by", `${c.reviewedBy?.name ?? "staff"}, ${dateTime(c.reviewedAt)}`]);
    if (c?.note && c.state === "REJECTED") meta.push(["Reason", c.note]);
    const review = c && isLatest && user.role !== "CLIENT" && canWorkOnCase(user, d.application) && (c.state === "UPLOADED" || c.state === "REJECTED") ? { applicationId: d.application.id, itemId: c.id, label: c.label } : undefined;
    return { title: c?.label ?? d.fileName, fileName: d.fileName, mime: d.mimeType, src: `/api/documents/${d.id}?inline=1`, download: `/api/documents/${d.id}`, back: appBack(d.application.id, d.application.reference), meta, review };
  }
  if (kind === "submission" || kind === "loanproof") {
    const x = await db.query.paymentSubmissions.findFirst({ where: eq(s.paymentSubmissions.id, id), with: { application: appCols, invoice: { columns: { number: true, currency: true } } } });
    if (!x || !(user.role === "FINANCE" || user.role === "ADMIN" || (user.role === "CLIENT" && x.application.clientId === user.id))) return null;
    const loan = kind === "loanproof";
    const key = loan ? x.loanDocKey : x.proofKey, fname = loan ? x.loanDocName : x.proofName;
    if (!key || !fname) return null;
    const q = loan ? "doc=loan&" : "";
    return { title: `${loan ? `Loan document (${x.loanProvider})` : "Proof of payment"} for ${x.invoice.number}`, fileName: fname, mime: loan ? mimeOf(fname) : x.proofMime ?? mimeOf(fname), src: `/api/files/submission/${x.id}?${q}inline=1`, download: `/api/files/submission/${x.id}${loan ? "?doc=loan" : ""}`,
      back: user.role === "CLIENT" ? appBack(x.application.id, x.application.reference) : { href: "/staff/finance/verify", label: "Back to payments to verify" },
      meta: [["Application", x.application.reference], ["Amount", money(x.amount, x.invoice.currency) ?? "-"], ["Method", PAYMENT_METHOD_LABEL[x.method]], ["Reference", x.reference], ["Status", x.status.charAt(0) + x.status.slice(1).toLowerCase()]] };
  }
  if (kind === "contract") {
    const c = await db.query.contracts.findFirst({ where: eq(s.contracts.id, id), with: { application: appCols } });
    if (!c || !(canViewDocuments(user, c.application) || user.role === "FINANCE")) return null;
    return { title: c.title, fileName: c.fileName, mime: c.mimeType, src: `/api/files/contract/${c.id}?inline=1`, download: `/api/files/contract/${c.id}`, back: appBack(c.application.id, c.application.reference),
      meta: [["Application", c.application.reference], ["Signed", dateTime(c.signedAt)], ["Method", c.method === "ONLINE" ? `Online by ${c.signedName}` : "Paper copy, uploaded by staff"]] };
  }
  if (kind === "case") {
    const f = await db.query.caseFiles.findFirst({ where: eq(s.caseFiles.id, id), with: { application: appCols, uploadedBy: { columns: { name: true } } } });
    if (!f || !canViewApplication(user, f.application)) return null;
    if (f.kind === "PAYMENT_EVIDENCE" && user.role !== "FINANCE" && user.role !== "ADMIN") return null;
    // The client opening their offer letter or visa is recorded (the first time).
    if (f.kind === "FINAL_DOC" && user.role === "CLIENT" && f.status === "UPLOADED") return null; // not shared yet
    if (user.role === "CLIENT" && !f.clientViewedAt) await db.update(s.caseFiles).set({ clientViewedAt: new Date(), ...(f.kind === "FINAL_DOC" && (f.status === "AVAILABLE" || f.status === "UPDATED") ? { status: "VIEWED" } : {}) }).where(eq(s.caseFiles.id, f.id));
    else if (user.role === "CLIENT" && f.kind === "FINAL_DOC" && (f.status === "AVAILABLE" || f.status === "UPDATED")) await db.update(s.caseFiles).set({ status: "VIEWED" }).where(eq(s.caseFiles.id, f.id));
    const meta: [string, string][] = [["Application", f.application.reference], ["Uploaded", `${dateTime(f.createdAt)}${user.role === "CLIENT" ? "" : ` by ${f.uploadedBy.name}`}`]];
    if (f.issuedOn) meta.push([f.kind === "VISA" ? "Visa issued" : "Dated", dateTime(f.issuedOn).split(",")[0]]);
    if (f.historical) meta.push(["Source", "From before the platform"]);
    if (f.category) meta.push(["Category", FINAL_CATEGORIES[f.category] ?? f.category]);
    if (f.note && (user.role !== "CLIENT" || f.kind === "FINAL_DOC")) meta.push([f.kind === "FINAL_DOC" ? "Description" : "Note", f.note]);
    if (f.clientViewedAt && user.role !== "CLIENT") meta.push(["Client opened it", dateTime(f.clientViewedAt)]);
    return { title: f.title, fileName: f.fileName, mime: f.mimeType, src: `/api/files/case/${f.id}?inline=1`, download: `/api/files/case/${f.id}`, back: appBack(f.application.id, f.application.reference), meta };
  }
  if (kind === "loan") {
    const l = await db.query.loanRequests.findFirst({ where: eq(s.loanRequests.id, id), with: { application: appCols } });
    if (!l?.docKey || !l.docName || !(user.role === "FINANCE" || user.role === "ADMIN" || (user.role === "CLIENT" && l.application.clientId === user.id))) return null;
    return { title: `Loan document for ${l.reference}`, fileName: l.docName, mime: l.docMime ?? mimeOf(l.docName), src: `/api/files/loan/${l.id}?inline=1`, download: `/api/files/loan/${l.id}`,
      back: user.role === "CLIENT" ? appBack(l.application.id, l.application.reference) : { href: "/staff/finance/loans", label: "Back to loan requests" }, meta: [["Application", l.application.reference], ["Provider", l.provider], ["Status", l.status.replace("_", " ").toLowerCase()]] };
  }
  if (kind === "refund") {
    const r = await db.query.refundRequests.findFirst({ where: eq(s.refundRequests.id, id), with: { application: appCols } });
    if (!r?.formKey || !canViewApplication(user, r.application)) return null;
    const name = r.formName ?? "refund-form.pdf";
    return { title: "Signed refund form", fileName: name, mime: mimeOf(name), src: `/api/files/refund/${r.id}?inline=1`, download: `/api/files/refund/${r.id}`, back: appBack(r.application.id, r.application.reference), meta: [["Application", r.application.reference], ["Submitted", dateTime(r.createdAt)]] };
  }
  if (kind === "amendment") {
    const a = await db.query.amendmentRequests.findFirst({ where: eq(s.amendmentRequests.id, id), with: { application: appCols } });
    if (!a?.attachmentKey || !canViewApplication(user, a.application)) return null;
    const name = a.attachmentName ?? "attachment.pdf";
    return { title: "Amendment attachment", fileName: name, mime: mimeOf(name), src: `/api/files/amendment/${a.id}?inline=1`, download: `/api/files/amendment/${a.id}`, back: appBack(a.application.id, a.application.reference), meta: [["Application", a.application.reference]] };
  }
  return null;
}
