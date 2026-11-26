import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(undefined, "/portal");
  return (
    <div className="bg-mist pb-10">
      <div className="border-b border-line bg-white">
        <div className="wrap flex flex-wrap items-center gap-3 py-3">
          <p className="font-display font-bold">Client portal</p>
          <nav className="flex gap-1 text-sm" aria-label="Portal"><Link className="rounded-lg px-3 py-2 font-medium hover:bg-mist" href="/portal">My applications</Link><Link className="rounded-lg px-3 py-2 font-medium hover:bg-mist" href="/portal/enquiries">My enquiries</Link></nav>
          <form action={logout} className="ml-auto flex items-center gap-3"><span className="text-sm muted">{user.name}</span><Link className="text-sm font-medium text-brand hover:underline" href="/account/password">Change password</Link><button className="btn-ghost btn-sm">Sign out</button></form>
        </div>
      </div>
      <div className="wrap pt-6">{children}</div>
    </div>
  );
}
