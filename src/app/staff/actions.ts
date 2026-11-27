"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { directAssign } from "./assignment-actions";

/** Admin assigns or reassigns from the applications list (same rules as Assignments). */
export async function assignConsultant(fd: FormData) {
  await directAssign(undefined, fd);
}

/** Marks the signed-in person's notifications (and their department's) as read. */
export async function markNotificationsRead() {
  const user = await requireUser();
  await db.update(s.notifications).set({ readAt: new Date() })
    .where(and(isNull(s.notifications.readAt), user.role === "CLIENT" ? eq(s.notifications.userId, user.id) : or(eq(s.notifications.userId, user.id), and(isNull(s.notifications.userId), eq(s.notifications.role, user.role)))));
  revalidatePath("/staff"); revalidatePath("/portal");
}
