// Which portal section a notification belongs to, so it can be shown in context (Payments, Contracts, Visa
// processing…) as well as in the notification center. Pure and unit-tested.
export const SECTIONS = ["payments", "contracts", "offer", "visa", "final", "appointments", "refunds", "reapplication", "messages", "documents", "assignment", "general"] as const;
export type Section = (typeof SECTIONS)[number];

export function sectionOf(link: string | null | undefined, title = ""): Section {
  const l = link ?? "", t = title.toLowerCase();
  if (l.startsWith("/staff/messages")) return "messages";
  if (/reapplication/.test(t)) return "reapplication";
  if (l.includes("/refunds") || /refund/.test(t)) return "refunds";
  if (l.includes("#final") || /final collection/.test(t)) return "final";
  if (l.includes("#visa") || /visa estimate|expected visa|visa (has been )?recorded|your visa/.test(t)) return "visa";
  if (l.includes("#offer") || /offer letter/.test(t)) return "offer";
  if (l.includes("#contract") || l.includes("#amendments") || /contract|amendment/.test(t)) return "contracts";
  if (l.includes("#appointments") || /appointment|invitation/.test(t)) return "appointments";
  if (l.includes("#invoices") || l.includes("/finance/verify") || l.includes("/finance/loans") || l.includes("/billing") || l.includes("/payments") || l.includes("#schedule") || l.includes("#historical") || /payment|invoice|receipt|instalment|loan|fee/.test(t)) return "payments";
  if (/document|checklist/.test(t)) return "documents";
  if (/assign|available/.test(t) || l.includes("/available") || l.includes("/assignments")) return "assignment";
  return "general";
}

export const applicationOf = (link: string | null | undefined) => (link ?? "").match(/\/applications\/([^/#?]+)/)?.[1] ?? null;
