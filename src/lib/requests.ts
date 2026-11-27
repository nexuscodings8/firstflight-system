// Labels shared by the client and staff screens for refunds and change requests.
export const AMENDMENT_KINDS = { CHANGE_LISTING: "Change the job, program or visa I applied for", CHANGE_DETAILS: "Correct my personal details", CHANGE_DATES: "Change my travel or start dates", OTHER: "Something else" } as const;

export const AMENDMENT_STATUS: Record<string, [string, string]> = {
  REQUESTED: ["Waiting for a decision", "bg-amber-50 text-amber-800"], APPROVED: ["Approved", "bg-emerald-50 text-emerald-700"], DECLINED: ["Declined", "bg-slate-100 text-slate-600"],
};
