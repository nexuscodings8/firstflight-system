"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { nextRef } from "@/lib/refs";
import { logActivity, notify } from "@/lib/activity";

export type EnqState = { error?: string } | undefined;
const TYPES = ["PROGRAM_GUIDANCE", "VISA_CONSULTATION", "JOB_QUESTION", "GENERAL"] as const;
const Schema = z.object({
  type: z.enum(TYPES),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(5, "Tell us a little about what you need").max(3000),
});

export async function submitEnquiry(_: EnqState, fd: FormData): Promise<EnqState> {
  const p = Schema.safeParse({ type: fd.get("type"), name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, message: fd.get("message") });
  if (!p.success) return { error: p.error.issues[0].message };
  let context: unknown = null;
  try { context = JSON.parse(String(fd.get("context") || "null")); } catch { context = null; }
  const user = await getCurrentUser();
  const ref = await db.transaction(async (tx) => {
    const reference = await nextRef(tx, "EQ");
    const [e] = await tx.insert(s.enquiries).values({ reference, ...p.data, phone: p.data.phone ?? null, context, clientId: user?.role === "CLIENT" ? user.id : null }).returning();
    await logActivity(tx, { actorId: user?.id, action: "enquiry.created", entityType: "enquiry", entityId: e.id, summary: `${p.data.name} sent ${reference} (${p.data.type.replace(/_/g, " ").toLowerCase()})` });
    await notify(tx, { role: "CONSULTANT", title: "New enquiry", body: `${reference} from ${p.data.name}`, link: "/staff" });
    return reference;
  });
  redirect(`/enquire/thanks?ref=${ref}`);
}
