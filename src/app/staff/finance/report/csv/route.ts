import { getCurrentUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { SERVICE_LABEL } from "@/lib/format";
import { paymentsForMonth } from "@/lib/report";

// Spreadsheet-safe cell: quotes, and a leading ' on anything a spreadsheet could run as a formula.
const cell = (v: string) => { const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return `"${t.replace(/"/g, '""')}"`; };

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !canManageFinance(user)) return new Response("Not allowed", { status: 403 });
  const ym = new URL(req.url).searchParams.get("month") ?? "";
  const rows = await paymentsForMonth(ym);
  if (!rows) return new Response("Use ?month=YYYY-MM", { status: 400 });
  const lines = [["Date paid", "Receipt", "Invoice", "Client", "Application", "Service", "Method", "Reference", "Currency", "Amount", "Recorded by"].map(cell).join(",")];
  for (const p of rows) lines.push([
    new Date(+p.paidAt + 2 * 3_600_000).toISOString().slice(0, 10), p.receiptNumber, p.invoice.number, p.invoice.application.client.name, p.invoice.application.reference,
    SERVICE_LABEL[p.invoice.application.service], PAYMENT_METHOD_LABEL[p.method], p.reference, p.invoice.currency, p.amount, p.recordedBy.name,
  ].map(String).map(cell).join(","));
  return new Response("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="firstflight-payments-${ym}.csv"`, "Cache-Control": "private, no-store" } });
}
