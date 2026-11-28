"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

/** Marks the notifications shown in one section as read (only the user's own, or their department's). */
export async function markNoticesRead(fd: FormData) {
  const user = await requireUser();
  const ids = fd.getAll("id").map(String).slice(0, 50);
  if (!ids.length) return;
  const mine = user.role === "CLIENT" ? eq(s.notifications.userId, user.id) : or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role)));
  await db.update(s.notifications).set({ readAt: new Date() }).where(and(inArray(s.notifications.id, ids), isNull(s.notifications.readAt), mine));
  const back = String(fd.get("path") ?? "");
  if (back.startsWith("/")) revalidatePath(back.split("#")[0]);
}
