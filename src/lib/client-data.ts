import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { balanceOf, fromCents } from "./finance";
import { money } from "./format";

/** Everything the client portal shows, for one client: their applications with checklists, invoices and requests. */
export async function clientApps(clientId: string) {
  return db.query.applications.findMany({
    where: eq(s.applications.clientId, clientId),
    orderBy: [desc(s.applications.createdAt)],
    with: {
      client: { columns: { name: true } },
      consultant: { columns: { name: true } },
      checklist: { orderBy: [asc(s.checklistItems.sortOrder)], with: { documents: { columns: { id: true, fileName: true, createdAt: true } } } },
      invoices: { orderBy: [asc(s.invoices.createdAt)], with: { payments: { orderBy: [asc(s.payments.paidAt)] } } },
      refunds: { orderBy: [desc(s.refundRequests.createdAt)], with: { invoice: { columns: { number: true } } } },
      amendments: { orderBy: [desc(s.amendmentRequests.createdAt)] },
    },
  });
}
export type ClientApp = Awaited<ReturnType<typeof clientApps>>[number];

/** Totals per currency across invoices that aren't void: "€1,500" or "$300 + €1,500". */
export function totals(apps: { invoices: { amount: string; currency: string; status: string; payments: { amount: string }[] }[] }[]) {
  const t = new Map<string, { total: number; paid: number; due: number }>();
  for (const a of apps) for (const i of a.invoices) {
    if (i.status === "VOID") continue;
    const b = balanceOf(i), cur = t.get(i.currency) ?? { total: 0, paid: 0, due: 0 };
    t.set(i.currency, { total: cur.total + b.total, paid: cur.paid + b.paid, due: cur.due + b.due });
  }
  const fmt = (k: "total" | "paid" | "due") => [...t].map(([c, v]) => money(fromCents(v[k]), c)).join(" + ") || money(0, "USD");
  return { total: fmt("total"), paid: fmt("paid"), due: fmt("due"), raw: t };
}
