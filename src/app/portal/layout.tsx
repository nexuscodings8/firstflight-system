import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { OPEN_STATES } from "@/lib/refunds";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/portal");
  if (user.role !== "CLIENT") redirect("/staff");
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
  const [unread, missing, refundForms] = await Promise.all([
    n(db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)))),
    n(db.select({ n: count() }).from(s.checklistItems).innerJoin(s.applications, eq(s.applications.id, s.checklistItems.applicationId))
      .where(and(eq(s.applications.clientId, user.id), eq(s.applications.status, "ACTIVE"), eq(s.checklistItems.mandatory, true), inArray(s.checklistItems.state, ["PENDING", "REQUESTED", "REJECTED"])))),
    n(db.select({ n: count() }).from(s.refundRequests).where(and(eq(s.refundRequests.clientId, user.id), inArray(s.refundRequests.state, OPEN_STATES)))),
  ]);
  return (
    <AppShell subtitle="Client portal" roleLabel="Client" name={user.name} home="/portal" items={[
      { href: "/portal", label: "Dashboard", icon: "grid" },
      { href: "/portal/applications", label: "My applications", icon: "file" },
      { href: "/portal/new", label: "New application", icon: "plus" },
      { href: "/portal/payments", label: "Payments and balance", icon: "card" },
      { href: "/portal/documents", label: "Document center", icon: "doc", count: missing },
      { href: "/portal/notifications", label: "Notifications", icon: "bell", count: unread },
      { href: "/portal/refunds", label: "Refund requests", icon: "refund", count: refundForms },
      { href: "/portal/changes", label: "Service amendments", icon: "amend" },
      { href: "/portal/enquiries", label: "My enquiries", icon: "msg" },
      { href: "/portal/profile", label: "Profile and settings", icon: "user" },
    ]}>{children}</AppShell>
  );
}
