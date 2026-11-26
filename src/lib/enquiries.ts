import "server-only";
import { db, schema as s } from "@/db";
import { nextRef } from "./refs";
import { logActivity, notify } from "./activity";

export type EnquiryInput = { type: "PROGRAM_GUIDANCE" | "VISA_CONSULTATION" | "JOB_QUESTION" | "GENERAL"; name: string; email: string; phone?: string; message: string };

/** Saves an enquiry, records it and tells the consultants. Returns its reference (EQ-2026-0001). */
export async function createEnquiry(data: EnquiryInput, context: unknown, user: { id: string; role: string } | null, via = "the website") {
  return db.transaction(async (tx) => {
    const reference = await nextRef(tx, "EQ");
    const [e] = await tx.insert(s.enquiries).values({ reference, ...data, phone: data.phone ?? null, context, clientId: user?.role === "CLIENT" ? user.id : null }).returning();
    await logActivity(tx, { actorId: user?.id, action: "enquiry.created", entityType: "enquiry", entityId: e.id, summary: `${data.name} sent ${reference} (${data.type.replace(/_/g, " ").toLowerCase()}) via ${via}` });
    await notify(tx, { role: "CONSULTANT", title: "New enquiry", body: `${reference} from ${data.name}`, link: "/staff/enquiries?show=new" });
    return reference;
  });
}
