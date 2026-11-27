import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/messaging";
import { isStaff } from "@/lib/permissions";
import { label } from "@/lib/format";
import { nowMs } from "@/lib/finance";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";
import { unassignedWhere } from "@/lib/create-application";
import { AppShell } from "@/components/shell/app-shell";
import type { NavItem } from "@/components/shell/side-nav";

const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);

/** Sidebar sections for each role, with counts of work waiting. */
async function sections(user: CurrentUser): Promise<NavItem[]> {
  const profile: NavItem = { href: "/staff/profile", label: "Profile and password", icon: "user" };
  const unread = await n(db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.userId, user.id), isNull(s.notifications.readAt))));
  const notes: NavItem = { href: "/staff/notifications", label: "Notifications", icon: "bell", count: unread };
  const msgs: NavItem = { href: "/staff/messages", label: "Messages", icon: "msg", count: await unreadTotal(user) };
  const pendingPay = () => n(db.select({ n: count() }).from(s.paymentSubmissions).where(eq(s.paymentSubmissions.status, "PENDING")));
  if (user.role === "CONSULTANT") {
    const mine = and(eq(s.applications.consultantId, user.id), eq(s.applications.status, "ACTIVE"));
    const services = user.services ?? [];
    const [elig, check, enq, changes, avail, refundsToReview] = await Promise.all([
      n(db.select({ n: count() }).from(s.applications).where(and(mine, eq(s.applications.stage, "ELIGIBILITY_REVIEW")))),
      n(db.select({ n: count() }).from(s.checklistItems).innerJoin(s.applications, eq(s.applications.id, s.checklistItems.applicationId)).where(and(mine, eq(s.checklistItems.state, "UPLOADED")))),
      n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW"))),
      n(db.select({ n: count() }).from(s.amendmentRequests).innerJoin(s.applications, eq(s.applications.id, s.amendmentRequests.applicationId)).where(and(eq(s.applications.consultantId, user.id), eq(s.amendmentRequests.source, "CLIENT"), eq(s.amendmentRequests.status, "REQUESTED")))),
      services.some((x) => x !== "FLIGHT") ? n(db.select({ n: count() }).from(s.applications).where(and(unassignedWhere, inArray(s.applications.service, services.filter((x) => x !== "FLIGHT") as ("WORK" | "STUDY" | "VISA")[])))) : Promise.resolve(0),
      n(db.select({ n: count() }).from(s.refundRequests).innerJoin(s.applications, eq(s.applications.id, s.refundRequests.applicationId)).where(and(eq(s.applications.consultantId, user.id), eq(s.refundRequests.state, "SUBMITTED")))),
    ]);
    return [
      { href: "/staff", label: "Overview", icon: "grid" },
      { href: "/staff/applications", label: "My applications", icon: "file", count: changes },
      { href: "/staff/applications?stage=ELIGIBILITY_REVIEW", label: "Eligibility queue", icon: "checkcircle", count: elig },
      { href: "/staff/applications?check=1", label: "Documents to check", icon: "doc", count: check },
      { href: "/staff/available", label: "Available clients", icon: "users", count: avail },
      { href: "/staff/clients/new", label: "Register a client", icon: "plus" },
      { href: "/staff/refunds", label: "Refund reviews", icon: "refund", count: refundsToReview },
      { href: "/staff/enquiries", label: "Enquiries", icon: "msg", count: enq },
      msgs,
      notes,
      profile,
    ];
  }
  if (user.role === "FINANCE") {
    const [unpaid, refunds, verify, amendFin] = await Promise.all([
      n(db.select({ n: count() }).from(s.invoices).where(and(inArray(s.invoices.status, ["ISSUED", "PARTIALLY_PAID"]), lt(s.invoices.dueDate, new Date(nowMs()))))),
      n(db.select({ n: count() }).from(s.refundRequests).where(inArray(s.refundRequests.state, ["FINANCE_REVIEW", "PROCESSING"]))),
      pendingPay(),
      n(db.select({ n: count() }).from(s.amendmentRequests).where(eq(s.amendmentRequests.state, "PENDING_FINANCE"))),
    ]);
    return [
      { href: "/staff", label: "Overview", icon: "grid" },
      { href: "/staff/applications", label: "Applications", icon: "file" },
      { href: "/staff/finance/verify", label: "Payments to verify", icon: "checkcircle", count: verify },
      { href: "/staff/finance", label: "Balances due", icon: "wallet", count: unpaid },
      { href: "/staff/finance?show=all", label: "All invoices", icon: "receipt" },
      { href: "/staff/finance/fees", label: "Service fees", icon: "tag" },
      { href: "/staff/refunds", label: "Refunds", icon: "refund", count: refunds },
      { href: "/staff/amendments", label: "Amendments", icon: "amend", count: amendFin },
      { href: "/staff/finance/report", label: "Monthly reports", icon: "chart" },
      { href: "/staff/settings?tab=refunds", label: "Refund rules", icon: "key" },
      msgs,
      notes,
      profile,
    ];
  }
  if (user.role === "CONTENT_MANAGER") {
    const stale = new Date(nowMs() - STALE_AFTER_DAYS * 86_400_000);
    const review = await n(db.select({ n: count() }).from(s.visaGuidance).where(and(eq(s.visaGuidance.status, "PUBLISHED"), or(eq(s.visaGuidance.reviewState, "NEEDS_REVIEW"), lt(s.visaGuidance.lastCheckedAt, stale)))));
    return [
      { href: "/staff/content", label: "Overview", icon: "grid" },
      { href: "/staff/content/countries", label: "Countries", icon: "globe" },
      { href: "/staff/content/jobs", label: "Job offers", icon: "briefcase" },
      { href: "/staff/content/universities", label: "Universities", icon: "cap" },
      { href: "/staff/content/programs", label: "Programs", icon: "doc" },
      { href: "/staff/content/visa-guidance", label: "Visa guidance", icon: "passport" },
      { href: "/staff/content/visa-review", label: "Review queue", icon: "checkcircle", count: review },
      { href: "/staff/content/promotions", label: "Promotions", icon: "star" },
      { href: "/staff/content/news", label: "News", icon: "news" },
      { href: "/staff/content/testimonials", label: "Testimonials", icon: "quote" },
      { href: "/staff/content/whatsapp", label: "WhatsApp contacts", icon: "msg" },
      msgs,
      notes,
      profile,
    ];
  }
  // ADMIN
  const [unassigned, refunds, enq, requests, verify, amendAdmin] = await Promise.all([
    n(db.select({ n: count() }).from(s.applications).where(and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE")))),
    n(db.select({ n: count() }).from(s.refundRequests).where(inArray(s.refundRequests.state, ["ADMIN_APPROVAL"]))),
    n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW"))),
    n(db.select({ n: count() }).from(s.assignmentRequests).where(eq(s.assignmentRequests.status, "PENDING"))),
    pendingPay(),
    n(db.select({ n: count() }).from(s.amendmentRequests).where(eq(s.amendmentRequests.state, "PENDING_APPROVAL"))),
  ]);
  return [
    { href: "/staff", label: "Overview", icon: "grid" },
    { href: "/staff/applications", label: "Applications", icon: "file" },
    { href: "/staff/assignments", label: "Assignments", icon: "users", count: requests + unassigned },
    { href: "/staff/clients/new", label: "Register a client", icon: "plus" },
    { href: "/staff/enquiries", label: "Enquiries", icon: "msg", count: enq },
    { href: "/staff/finance/verify", label: "Payments to verify", icon: "checkcircle", count: verify },
    { href: "/staff/finance", label: "Invoices", icon: "receipt" },
    { href: "/staff/finance/fees", label: "Service fees", icon: "tag" },
    { href: "/staff/refunds", label: "Refunds", icon: "refund", count: refunds },
    { href: "/staff/amendments", label: "Amendments", icon: "amend", count: amendAdmin },
    { href: "/staff/finance/report", label: "Monthly reports", icon: "chart" },
    { href: "/staff/content", label: "Website content", icon: "layout" },
    { href: "/staff/users", label: "Staff and roles", icon: "users" },
    { href: "/staff/permissions", label: "Service permissions", icon: "key" },
    { href: "/staff/settings", label: "Settings", icon: "layout" },
    { href: "/staff/activity", label: "Audit log", icon: "shield" },
    { href: "/staff/launch", label: "Launch checks", icon: "rocket" },
    msgs,
    notes,
    profile,
  ];
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/staff");
  if (!isStaff(user.role)) redirect("/portal");
  return (
    <AppShell subtitle={`Staff dashboard · ${label(user.role)}`} roleLabel={label(user.role)} name={user.name} home={user.role === "CONTENT_MANAGER" ? "/staff/content" : "/staff"} items={await sections(user)}>
      {children}
    </AppShell>
  );
}
