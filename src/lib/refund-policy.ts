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

// ---------- after the application is completed ----------
// Refund and reapplication are shown as soon as an application is completed, each disabled until its own
// eligibility date (the completion date plus that option's waiting period).
export type OptionKind = "REFUND" | "REAPPLICATION";
export type Waiting = { state: "WAITING" | "AVAILABLE"; opensOn: Date; daysLeft: number; text: string };
const DAY = 86_400_000;

export function afterCompletion(completedAt: Date, waitDays: number, now = new Date()): Waiting {
  const opensOn = new Date(+completedAt + waitDays * DAY);
  if (+now >= +opensOn) return { state: "AVAILABLE", opensOn, daysLeft: 0, text: `Available since ${fmt(opensOn)}.` };
  const daysLeft = Math.ceil((+opensOn - +now) / DAY);
  return { state: "WAITING", opensOn, daysLeft, text: `Available on ${fmt(opensOn)}. You can submit this request in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` };
}

export type OptionStatus = "WAITING" | "AVAILABLE" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "BLOCKED";
export const OPTION_LABEL: Record<OptionStatus, string> = { WAITING: "Waiting period", AVAILABLE: "Available", SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", APPROVED: "Approved", REJECTED: "Rejected", BLOCKED: "Another request is in progress" };

/** Where one option stands: its own latest request since completion decides, otherwise the waiting period. */
export function optionStatus(kind: OptionKind, completedAt: Date, w: Waiting, requests: { kind: string; state: string; createdAt: Date }[]): { status: OptionStatus; canSubmit: boolean } {
  const mine = requests.filter((r) => r.kind === kind && +r.createdAt >= +completedAt).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  const otherOpen = requests.some((r) => r.kind !== kind && ["SUBMITTED", "FINANCE_REVIEW", "ADMIN_APPROVAL", "APPROVED", "PROCESSING"].includes(r.state));
  if (mine?.state === "SUBMITTED") return { status: "SUBMITTED", canSubmit: false };
  if (mine && ["FINANCE_REVIEW", "ADMIN_APPROVAL", "PROCESSING"].includes(mine.state)) return { status: "UNDER_REVIEW", canSubmit: false };
  if (mine && (mine.state === "APPROVED" || mine.state === "COMPLETED")) return { status: "APPROVED", canSubmit: false };
  if (w.state === "WAITING") return { status: "WAITING", canSubmit: false };
  if (otherOpen) return { status: "BLOCKED", canSubmit: false };
  if (mine?.state === "REJECTED") return { status: "REJECTED", canSubmit: true };
  return { status: "AVAILABLE", canSubmit: true };
}
