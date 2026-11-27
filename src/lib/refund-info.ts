import "server-only";
import { getRefundPolicy } from "./settings";
import { refundEligibility } from "./refund-policy";
import { firstPaymentAt } from "./refunds";

/** What the refund section of an application should offer right now. */
export async function refundInfo(app: { service: string; invoices: { payments: { paidAt: Date }[] }[] }) {
  const policy = await getRefundPolicy(app.service);
  const elig = refundEligibility(policy, firstPaymentAt(app.invoices));
  return { elig: { state: elig.state, text: elig.text }, allowReapplication: policy.allowReapplication && elig.state !== "NO_PAYMENT", refundOpen: elig.state === "OPEN", terms: policy.terms };
}
export type RefundInfo = Awaited<ReturnType<typeof refundInfo>>;
