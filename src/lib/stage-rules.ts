// Which application stages need an approved payment or a signed contract. Pure and unit-tested; the server checks
// these on every stage change, whoever asks (consultants and admins alike).
import { STAGES } from "./format";

export type Facts = { firstPaid: boolean; contractSigned: boolean; allPaid: boolean };
const idx = (st: string) => STAGES.indexOf(st as (typeof STAGES)[number]);

/** Returns why the application can't be moved to `target` (or marked completed), or null if it can. */
export function stageBlock(target: string, completing: boolean, f: Facts): string | null {
  const t = completing ? STAGES.length - 1 : idx(target);
  if (t >= idx("DOCUMENT_SIGNING") && !f.firstPaid) return "Finance hasn't approved the first instalment yet. The application moves on automatically once they do.";
  if (t >= idx("PROCESSING") && !f.contractSigned) return "The client's contract isn't signed yet. Ask them to sign online, or upload the signed paper copy.";
  if (t >= idx("FINAL_COLLECTION") && !f.allPaid) return "All instalments must be approved by Finance before Final collection.";
  return null;
}

type Inv = { id: string; status: string; createdAt: Date };
/** First instalment = first invoice of the agreed fee plan, otherwise the earliest invoice that isn't void. */
export function paymentFacts(invoices: Inv[], firstPlanInvoiceId: string | null) {
  const live = invoices.filter((i) => i.status !== "VOID").sort((a, b) => +a.createdAt - +b.createdAt);
  const first = (firstPlanInvoiceId && live.find((i) => i.id === firstPlanInvoiceId)) || live[0];
  return { firstPaid: !!first && first.status === "PAID", allPaid: live.length > 0 && live.every((i) => i.status === "PAID") };
}
