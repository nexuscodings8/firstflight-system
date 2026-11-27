// Refund eligibility from a service's policy and the date of the client's first approved payment. Pure, unit-tested.
export type Policy = { eligibleAfterDays: number; windowDays: number };
export type Eligibility =
  | { state: "NO_PAYMENT"; text: string }
  | { state: "NOT_YET"; opensOn: Date; text: string }
  | { state: "OPEN"; opensOn: Date; closesOn: Date | null; text: string }
  | { state: "CLOSED"; opensOn: Date; closesOn: Date; text: string };

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali" });

export function refundEligibility(policy: Policy, firstPaymentAt: Date | null, now = new Date()): Eligibility {
  if (!firstPaymentAt) return { state: "NO_PAYMENT", text: "Refunds apply to approved payments. You haven't made one on this application yet." };
  const opensOn = new Date(+firstPaymentAt + policy.eligibleAfterDays * 86_400_000);
  const closesOn = policy.windowDays > 0 ? new Date(+opensOn + policy.windowDays * 86_400_000) : null;
  if (+now < +opensOn) return { state: "NOT_YET", opensOn, text: `Under this service's policy, refund requests open on ${fmt(opensOn)}, ${policy.eligibleAfterDays} days after your first approved payment.` };
  if (closesOn && +now >= +closesOn) return { state: "CLOSED", opensOn, closesOn, text: `The refund period for this service ended on ${fmt(closesOn)}. Contact your consultant if you think an exception applies.` };
  return { state: "OPEN", opensOn, closesOn, text: closesOn ? `You can request a refund until ${fmt(closesOn)}.` : "You can request a refund at any time under this service's policy." };
}
