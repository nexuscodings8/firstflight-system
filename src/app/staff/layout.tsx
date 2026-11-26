import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { isStaff, type Role } from "@/lib/permissions";
import { label } from "@/lib/format";
import { nowMs } from "@/lib/finance";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";
import { AppShell } from "@/components/shell/app-shell";
import type { NavItem } from "@/components/shell/side-nav";

const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);

/** Sidebar sections for each role, with counts of work waiting. */
async function sections(user: { id: string; role: Role }): Promise<NavItem[]> {
  const profile: NavItem = { href: "/staff/profile", label: "Profile and password", icon: "user" };
  if (user.role === "CONSULTANT") {
    const mine = and(eq(s.applications.consultantId, user.id), eq(s.applications.status, "ACTIVE"));
    const [elig, check, enq, changes] = await Promise.all([
      n(db.select({ n: count() }).from(s.applications).where(and(mine, eq(s.applications.stage, "ELIGIBILITY_REVIEW")))),
      n(db.select({ n: count() }).from(s.checklistItems).innerJoin(s.applications, eq(s.applications.id, s.checklistItems.applicationId)).where(and(mine, eq(s.checklistItems.state, "UPLOADED")))),
      n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW"))),
      n(db.select({ n: count() }).from(s.amendmentRequests).innerJoin(s.applications, eq(s.applications.id, s.amendmentRequests.applicationId)).where(and(eq(s.applications.consultantId, user.id), eq(s.amendmentRequests.status, "REQUESTED")))),
    ]);
    return [
      { href: "/staff", label: "Overview", icon: "grid" },
      { href: "/staff/applications", label: "My applications", icon: "file", count: changes },
      { href: "/staff/applications?stage=ELIGIBILITY_REVIEW", label: "Eligibility queue", icon: "checkcircle", count: elig },
      { href: "/staff/applications?check=1", label: "Documents to check", icon: "doc", count: check },
      { href: "/staff/enquiries", label: "Enquiries", icon: "msg", count: enq },
      profile,
    ];
  }
  if (user.role === "FINANCE") {
    const [unpaid, refunds] = await Promise.all([
      n(db.select({ n: count() }).from(s.invoices).where(and(inArray(s.invoices.status, ["ISSUED", "PARTIALLY_PAID"]), lt(s.invoices.dueDate, new Date(nowMs()))))),
      n(db.select({ n: count() }).from(s.refundRequests).where(inArray(s.refundRequests.status, ["REQUESTED", "FORM_SUBMITTED"]))),
    ]);
    return [
      { href: "/staff", label: "Overview", icon: "grid" },
      { href: "/staff/applications", label: "Applications", icon: "file" },
      { href: "/staff/finance", label: "Balances due", icon: "wallet", count: unpaid },
      { href: "/staff/finance?show=all", label: "All invoices", icon: "receipt" },
      { href: "/staff/finance/fees", label: "Service fees", icon: "tag" },
      { href: "/staff/finance/refunds", label: "Refunds", icon: "refund", count: refunds },
      { href: "/staff/finance/report", label: "Monthly reports", icon: "chart" },
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
      profile,
    ];
  }
  // ADMIN
  const [unassigned, refunds, enq] = await Promise.all([
    n(db.select({ n: count() }).from(s.applications).where(and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE")))),
    n(db.select({ n: count() }).from(s.refundRequests).where(inArray(s.refundRequests.status, ["REQUESTED", "FORM_SUBMITTED"]))),
    n(db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, "NEW"))),
  ]);
  return [
    { href: "/staff", label: "Overview", icon: "grid" },
    { href: "/staff/applications", label: "Applications", icon: "file", count: unassigned },
    { href: "/staff/enquiries", label: "Enquiries", icon: "msg", count: enq },
    { href: "/staff/finance", label: "Invoices", icon: "receipt" },
    { href: "/staff/finance/fees", label: "Service fees", icon: "tag" },
    { href: "/staff/finance/refunds", label: "Refunds", icon: "refund", count: refunds },
    { href: "/staff/finance/report", label: "Monthly reports", icon: "chart" },
    { href: "/staff/content", label: "Website content", icon: "layout" },
    { href: "/staff/users", label: "Staff and roles", icon: "users" },
    { href: "/staff/activity", label: "Audit log", icon: "shield" },
    { href: "/staff/launch", label: "Launch checks", icon: "rocket" },
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
