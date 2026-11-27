// Invoice facts for applications. The stage gates themselves live in lib/schedule.ts.

type Inv = { id: string; status: string; createdAt: Date };
/** First instalment = first invoice of the agreed fee plan, otherwise the earliest invoice that isn't void. */
export function paymentFacts(invoices: Inv[], firstPlanInvoiceId: string | null) {
  const live = invoices.filter((i) => i.status !== "VOID").sort((a, b) => +a.createdAt - +b.createdAt);
  const first = (firstPlanInvoiceId && live.find((i) => i.id === firstPlanInvoiceId)) || live[0];
  return { firstPaid: !!first && first.status === "PAID", allPaid: live.length > 0 && live.every((i) => i.status === "PAID") };
}
