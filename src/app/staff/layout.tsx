import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { logout } from "@/app/(auth)/actions";
import { label } from "@/lib/format";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/staff");
  if (!isStaff(user.role)) redirect("/portal");
  return (
    <div className="bg-mist pb-10">
      <div className="border-b border-line bg-navy text-white">
        <div className="wrap flex flex-wrap items-center gap-3 py-3">
          <p className="font-display font-bold">Staff dashboard</p>
          <span className="badge bg-gold text-ink">{label(user.role)}</span>
          <form action={logout} className="ml-auto flex items-center gap-3"><span className="text-sm text-white/80">{user.name}</span><button className="btn-sm btn border border-white/40 text-white hover:bg-white/10">Sign out</button></form>
        </div>
      </div>
      <div className="wrap pt-6">{children}</div>
    </div>
  );
}
