import { getCurrentUser } from "@/lib/auth";
import { canViewInvoice } from "@/lib/permissions";
import { loadPayment, receiptPdf } from "@/lib/billing-pdf";
import { pdfResponse } from "@/lib/pdf";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in required", { status: 401 });
  const pay = await loadPayment((await ctx.params).id);
  if (!pay || !canViewInvoice(user, pay.invoice.application)) return new Response("Not found", { status: 404 });
  return pdfResponse(await receiptPdf(pay), `${pay.receiptNumber}.pdf`);
}
