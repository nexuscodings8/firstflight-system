import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isStaff, type Role } from "@/lib/permissions";
import { logout } from "@/app/(auth)/actions";
import { label } from "@/lib/format";

const NAV: { href: string; text: string; roles: Role[] }[] = [
  { href: "/staff", text: "Dashboard", roles: ["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"] },
  { href: "/staff/enquiries", text: "Enquiries", roles: ["ADMIN", "CONSULTANT"] },
  { href: "/staff/finance", text: "Finance", roles: ["ADMIN", "FINANCE"] },
  { href: "/staff/content", text: "Content", roles: ["ADMIN", "CONTENT_MANAGER"] },
  { href: "/staff/users", text: "Users", roles: ["ADMIN"] },
  { href: "/staff/activity", text: "Activity", roles: ["ADMIN"] },
  { href: "/staff/launch", text: "Launch checks", roles: ["ADMIN"] },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/staff");
  if (!isStaff(user.role)) redirect("/portal");
  return (
    <div className="bg-mist pb-10 print:bg-white">
      <div className="no-print border-b border-line bg-navy text-white">
        <div className="wrap flex flex-wrap items-center gap-3 py-3">
          <p className="font-display font-bold">Staff dashboard</p>
          <span className="badge bg-gold text-ink">{label(user.role)}</span>
          <nav aria-label="Staff" className="flex flex-wrap gap-1 text-sm">{NAV.filter((n) => n.roles.includes(user.role)).map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 font-medium text-white/90 hover:bg-white/10 hover:text-white">{n.text}</Link>)}</nav>
          <form action={logout} className="ml-auto flex items-center gap-3"><span className="text-sm text-white/80">{user.name}</span><Link className="text-sm font-medium text-white underline-offset-2 hover:underline" href="/account/password">Change password</Link><button className="btn-sm btn border border-white/40 text-white hover:bg-white/10">Sign out</button></form>
        </div>
      </div>
      <div className="wrap pt-6">{children}</div>
    </div>
  );
}
