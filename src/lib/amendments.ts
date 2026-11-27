export const AMEND_STATE: Record<string, [string, string]> = {
  PENDING_FINANCE: ["Finance to confirm the fee", "bg-amber-50 text-amber-800"],
  PENDING_APPROVAL: ["Waiting for admin approval", "bg-amber-50 text-amber-800"],
  AWAITING_SIGNATURE: ["Waiting for the client's signature", "bg-blue-50 text-brand"],
  SIGNED: ["Signed", "bg-emerald-50 text-emerald-700"],
  REJECTED: ["Rejected", "bg-slate-100 text-slate-600"],
};
