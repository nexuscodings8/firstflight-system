"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveSelection, SELECTION_KEYS } from "@/lib/selection";
import { createApplication } from "@/lib/create-application";

export type ApplyState = { error?: string } | undefined;

export async function submitApplication(_: ApplyState, fd: FormData): Promise<ApplyState> {
  const user = await requireUser(["CLIENT"]);
  const q = Object.fromEntries(SELECTION_KEYS.map((k) => [k, fd.get(k) ? String(fd.get(k)) : undefined]));
  const sel = await resolveSelection(q);
  if (!sel) return { error: "This listing is no longer available." };
  if (!sel.open) return { error: "This listing is not accepting applications right now." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000) || null;
  // One active application per client, checked again inside the transaction.
  const r = await createApplication({ client: user, sel, note, actor: user, via: "client" });
  if ("existing" in r && r.existing) redirect(`/portal/applications/${r.existing.id}?existing=1`);
  redirect(`/portal/applications/${r.created!.id}?submitted=1`);
}
