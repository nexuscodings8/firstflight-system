import { PaidBar } from "./boarding-pass";
import { balanceOf, fromCents } from "@/lib/finance";
import { money } from "@/lib/format";
import type { FullApplication } from "@/lib/applications";

/** "Paid X of Y" when all invoices share one currency; otherwise nothing (the invoices section has the detail). */
export function paidStub(app: FullApplication) {
  const inv = app.invoices.filter((i) => i.status !== "VOID");
  if (!inv.length) return <span className="muted">No fees issued yet</span>;
  const cur = inv[0].currency;
  if (!inv.every((i) => i.currency === cur)) return <span className="muted">Fees in several currencies</span>;
  const paid = inv.reduce((n, i) => n + balanceOf(i).paid, 0), total = inv.reduce((n, i) => n + balanceOf(i).total, 0);
  return <PaidBar paid={paid} total={total} text={`${money(fromCents(paid), cur)} of ${money(fromCents(total), cur)}`} />;
}
