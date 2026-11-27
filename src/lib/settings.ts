import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { COMPANY } from "./company";

export type Office = { address: string; mapsUrl: string; phone: string; hours: string; confirmed: boolean };
export type RefundPolicy = { eligibleAfterDays: number; windowDays: number; allowReapplication: boolean; terms: string };
export const SERVICES = ["WORK", "STUDY", "VISA"] as const;
export const ALL_SERVICES = ["WORK", "STUDY", "VISA", "FLIGHT"] as const;
export type Service = (typeof SERVICES)[number];

const DEFAULT_OFFICE: Office = {
  address: "FIRST FLIGHT office, Kigali, Rwanda",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=FIRST+FLIGHT+Kigali+Rwanda",
  phone: COMPANY.phones[0], hours: "Monday to Friday, 8:00 to 17:00", confirmed: false,
};
// Until Finance/Admin set them, refunds open straight after the first payment and stay open for 90 days.
const DEFAULT_POLICY: RefundPolicy = { eligibleAfterDays: 0, windowDays: 90, allowReapplication: true, terms: "Refunds follow the terms of your signed service contract." };

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.query.settings.findFirst({ where: eq(s.settings.key, key) });
  return row ? { ...fallback, ...(row.value as object) } as T : fallback;
}

export const getOffice = () => read<Office>("office", DEFAULT_OFFICE);
export const getRefundPolicy = (service: string) => read<RefundPolicy>(`refund_policy:${service}`, DEFAULT_POLICY);
export async function getRefundPolicies() {
  return Object.fromEntries(await Promise.all(SERVICES.map(async (sv) => [sv, await getRefundPolicy(sv)] as const))) as Record<Service, RefundPolicy>;
}

export async function saveSetting(key: string, value: unknown, userId: string) {
  await db.insert(s.settings).values({ key, value, updatedById: userId }).onConflictDoUpdate({ target: s.settings.key, set: { value, updatedById: userId, updatedAt: new Date() } });
}

const SERVICE_NAME: Record<string, string> = { WORK: "Work Abroad", STUDY: "Study Abroad", VISA: "Visa Processing" };

/** Sample wording, clearly marked, so the signing flow works before FIRST FLIGHT's lawyer-approved text is entered. */
export const defaultContractBody = (service: string) => `SERVICE AGREEMENT: ${SERVICE_NAME[service] ?? service}

[SAMPLE TEXT: FIRST FLIGHT must replace this with its lawyer-approved contract in Settings → Contracts before real clients sign.]

This agreement is between FIRST FLIGHT BEST TRAVEL SOLUTION LTD ("FIRST FLIGHT") and {{client_name}} ("the Client"), email {{client_email}}, phone {{client_phone}}, for application {{reference}}: {{listing}}.

1. Services. FIRST FLIGHT will provide the ${SERVICE_NAME[service] ?? service} service described in application {{reference}}, including document guidance, application processing and follow-up.

2. Fees. The agreed service fee is {{fee}}, payable as follows:
{{installments}}
The agreed fee does not change if FIRST FLIGHT's published prices change, unless both parties sign an amendment.

3. Client duties. The Client will provide true, complete documents on time and inform FIRST FLIGHT of any change in circumstances.

4. Decisions by third parties. Employers, universities and embassies make their own decisions. FIRST FLIGHT cannot guarantee their outcome.

5. Refunds. Refunds follow FIRST FLIGHT's refund policy for this service, as shown in the client portal.

6. Signature. By signing electronically, the Client confirms they have read and accept this agreement. Date: {{date}}.`;

/** The current template for a service, creating version 1 with the sample wording if none exists yet. */
export async function currentTemplate(service: string) {
  const t = await db.query.contractTemplates.findFirst({ where: and(eq(s.contractTemplates.service, service), eq(s.contractTemplates.active, true)), orderBy: [desc(s.contractTemplates.version)] });
  if (t) return t;
  const [row] = await db.insert(s.contractTemplates).values({ service, version: 1, title: `${SERVICE_NAME[service] ?? service} service agreement`, body: defaultContractBody(service) }).onConflictDoNothing().returning();
  return row ?? (await db.query.contractTemplates.findFirst({ where: eq(s.contractTemplates.service, service), orderBy: [desc(s.contractTemplates.version)] }))!;
}
