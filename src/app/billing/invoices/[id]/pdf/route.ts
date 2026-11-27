import { getCurrentUser } from "@/lib/auth";
import { canViewInvoice } from "@/lib/permissions";
import { invoicePdf, loadInvoice } from "@/lib/billing-pdf";
import { pdfResponse } from "@/lib/pdf";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in required", { status: 401 });
  const inv = await loadInvoice((await ctx.params).id);
  if (!inv || !canViewInvoice(user, inv.application)) return new Response("Not found", { status: 404 });
  return pdfResponse(await invoicePdf(inv), `${inv.number}.pdf`);
}
