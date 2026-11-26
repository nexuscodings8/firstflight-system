"use server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createEnquiry } from "@/lib/enquiries";
import { clientIp, hit } from "@/lib/rate-limit";

export type HandoffState = { ok?: string; error?: string } | undefined;
const Schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(5, "Tell us briefly what you need").max(2000),
});

/** The assistant's "talk to a consultant": becomes an enquiry with the chat so far attached. */
export async function assistantHandoff(_: HandoffState, fd: FormData): Promise<HandoffState> {
  const p = Schema.safeParse({ name: fd.get("name"), email: fd.get("email"), phone: String(fd.get("phone") ?? "") || undefined, message: fd.get("message") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (!hit(`enquiry:${await clientIp()}`, 8, 3_600_000).ok) return { error: "You've sent several messages in the last hour. Please call or WhatsApp us instead." };
  const transcript = String(fd.get("transcript") ?? "").slice(0, 4000);
  const page = String(fd.get("page") ?? "").slice(0, 200);
  const ref = await createEnquiry({ type: "GENERAL", ...p.data }, { source: "assistant", page, transcript }, await getCurrentUser(), "the website assistant");
  return { ok: `Thank you. Your reference is ${ref}. A consultant will reply to ${p.data.email}${p.data.phone ? ` or call ${p.data.phone}` : ""}.` };
}
