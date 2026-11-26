import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { PasswordForm } from "@/components/password-form";
import { logout } from "@/app/(auth)/actions";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser(undefined, "/account/password", { allowPasswordPending: true });
  const back = isStaff(user.role) ? "/staff" : "/portal";
  return (
    <div className="bg-mist py-10">
      <div className="wrap max-w-md">
        {user.mustChangePassword
          ? <p role="status" className="rounded-2xl bg-gold/20 p-4 text-sm font-medium">You signed in with a temporary password. Choose your own password to continue.</p>
          : <Link href={back} className="text-sm font-medium text-brand hover:underline">← Back to {isStaff(user.role) ? "staff dashboard" : "client portal"}</Link>}
        <div className="card mt-4 p-6">
          <h1 className="font-display text-2xl font-bold">{user.mustChangePassword ? "Choose your password" : "Change password"}</h1>
          <p className="mt-1 mb-5 text-sm muted">Signed in as {user.email}</p>
          <PasswordForm required={user.mustChangePassword} home={back} />
        </div>
        {user.mustChangePassword && <form action={logout} className="mt-4 text-center"><button className="text-sm font-medium text-brand hover:underline">Sign out</button></form>}
      </div>
    </div>
  );
}
