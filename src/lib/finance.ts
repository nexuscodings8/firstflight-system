// Pure money rules, shared by server actions, pages and unit tests. Amounts are handled in cents to avoid float errors.
export const CURRENCIES = ["USD", "RWF", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const toCents = (v: string | number) => Math.round(Number(v) * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

/** Parses a money amount typed by staff ("1,250.50" → 125050 cents). Returns null if invalid or not positive. */
export function parseAmount(raw: string): number | null {
  const t = raw.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const c = toCents(t);
  return c > 0 && c < 100_000_000_000 ? c : null;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

/** Status after payments: VOID stays VOID; otherwise follows what has been paid. */
export function statusAfterPayments(current: InvoiceStatus, amountCents: number, paidCents: number): InvoiceStatus {
  if (current === "VOID") return "VOID";
  if (paidCents <= 0) return "ISSUED";
  return paidCents >= amountCents ? "PAID" : "PARTIALLY_PAID";
}

export function balanceOf(inv: { amount: string; status: string; payments: { amount: string }[] }) {
  const paid = inv.payments.reduce((n, p) => n + toCents(p.amount), 0);
  const total = toCents(inv.amount);
  return { total, paid, due: inv.status === "VOID" ? 0 : Math.max(total - paid, 0) };
}

/** Payment references are compared without spaces or case, so "MP 123" and "mp123" count as the same payment. */
export const normaliseRef = (r: string) => r.replace(/\s+/g, "").toUpperCase();

/** "2026-11" → [start, end) of that month in UTC+2 (Kigali), so a payment at 23:30 local time lands in the right month. */
export function monthRange(ym: string): [Date, Date] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1) - 2 * 3_600_000);
  const end = new Date(Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1) - 2 * 3_600_000);
  return [start, end];
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", MOBILE_MONEY: "Mobile money", CARD: "Card" };

/** Current month in Kigali time, as "YYYY-MM". */
export const currentMonth = (now = Date.now()) => new Date(now + 2 * 3_600_000).toISOString().slice(0, 7);
export const nowMs = () => Date.now();
