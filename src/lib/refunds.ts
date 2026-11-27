// Refund and reapplication workflow: states, wording and the order of steps. Shared by client and staff screens.
export const REFUND_STEPS = ["SUBMITTED", "FINANCE_REVIEW", "ADMIN_APPROVAL", "APPROVED", "PROCESSING", "COMPLETED"] as const;
export const REAPPLY_STEPS = ["SUBMITTED", "FINANCE_REVIEW", "ADMIN_APPROVAL", "COMPLETED"] as const;
export const OPEN_STATES = ["SUBMITTED", "FINANCE_REVIEW", "ADMIN_APPROVAL", "APPROVED", "PROCESSING"];

export const STEP_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted: consultant review", FINANCE_REVIEW: "Finance review", ADMIN_APPROVAL: "Admin approval",
  APPROVED: "Approved", PROCESSING: "Payment processing", COMPLETED: "Completed", REJECTED: "Rejected",
};
export const STATE_BADGE: Record<string, [string, string]> = {
  SUBMITTED: ["Consultant review", "bg-amber-50 text-amber-800"],
  FINANCE_REVIEW: ["Finance review", "bg-amber-50 text-amber-800"],
  ADMIN_APPROVAL: ["Waiting for admin approval", "bg-amber-50 text-amber-800"],
  APPROVED: ["Approved: payment to be processed", "bg-blue-50 text-brand"],
  PROCESSING: ["Payment being processed", "bg-blue-50 text-brand"],
  COMPLETED: ["Completed", "bg-emerald-50 text-emerald-700"],
  REJECTED: ["Rejected", "bg-slate-100 text-slate-600"],
};
export const KIND_LABEL: Record<string, string> = { REFUND: "Refund", REAPPLICATION: "Reapplication instead of a refund" };

/** Which steps a request goes through, and how far it got. */
export function trackOf(r: { kind: string; state: string }) {
  const steps: readonly string[] = r.kind === "REAPPLICATION" ? REAPPLY_STEPS : REFUND_STEPS;
  const at = r.state === "REJECTED" ? -1 : steps.indexOf(r.state);
  return steps.map((st, i) => ({ step: st, label: STEP_LABEL[st], done: r.state === "COMPLETED" || (at >= 0 && i < at), current: i === at && r.state !== "COMPLETED" }));
}

/** The first approved payment on an application, which starts the refund period. */
export const firstPaymentAt = (invoices: { payments: { paidAt: Date }[] }[]) =>
  invoices.flatMap((i) => i.payments.map((p) => p.paidAt)).sort((a, b) => +a - +b)[0] ?? null;
