import "server-only";
import { headers } from "next/headers";

// Simple fixed-window limiter kept in memory. Enough for one server instance (the Render free/starter plan);
// with several instances each keeps its own count, which still slows down abuse.
const buckets = new Map<string, { n: number; reset: number }>();

export function hit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.reset <= now) { buckets.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryInS: 0 }; }
  b.n += 1;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  return b.n <= limit ? { ok: true, retryInS: 0 } : { ok: false, retryInS: Math.ceil((b.reset - now) / 1000) };
}

/** The visitor's address as seen through Render's proxy. */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** True when `key` has already used up `limit` in its current window (does not count as a hit). */
export function blocked(key: string, limit: number, now = Date.now()) {
  const b = buckets.get(key);
  return !!b && b.reset > now && b.n >= limit;
}
