"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createEnquiry } from "@/lib/enquiries";
import { clientIp, hit } from "@/lib/rate-limit";

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
  const ip = await clientIp();
  if (!hit(`enquiry:${ip}`, 8, 3_600_000).ok) return { error: "You've sent several enquiries in the last hour. Please call or WhatsApp us instead." };
  const ref = await createEnquiry({ ...p.data, phone: p.data.phone }, context, user);
  redirect(`/enquire/thanks?ref=${ref}`);
}
