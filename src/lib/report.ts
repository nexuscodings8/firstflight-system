import "server-only";
import { and, asc, gte, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { monthRange } from "./finance";

/** Payments recorded in a calendar month (Kigali time), with their invoice and client. */
export async function paymentsForMonth(ym: string) {
  const r = monthRange(ym);
  if (!r) return null;
  return db.query.payments.findMany({
    where: and(gte(s.payments.paidAt, r[0]), lt(s.payments.paidAt, r[1])),
    orderBy: [asc(s.payments.paidAt), asc(s.payments.receiptNumber)],
    with: { recordedBy: { columns: { name: true } }, invoice: { columns: { number: true, currency: true, description: true }, with: { application: { columns: { reference: true, service: true }, with: { client: { columns: { name: true } } } } } } },
  });
}
