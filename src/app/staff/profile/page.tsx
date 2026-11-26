import { requireUser } from "@/lib/auth";
import { label } from "@/lib/format";
import { PasswordForm } from "@/components/password-form";

export const metadata = { title: "Profile and password" };

export default async function StaffProfile() {
  const me = await requireUser(["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER"], "/staff/profile");
  return (
    <div className="grid max-w-3xl gap-5">
      <h1 className="text-[clamp(26px,3vw,36px)]">Profile and password</h1>
      <section className="card p-6">
        <dl className="grid gap-3 sm:grid-cols-3">{[["Name", me.name], ["Email", me.email], ["Role", label(me.role)]].map(([k, v]) => <div key={k} className="rounded-xl bg-mist p-3"><dt className="text-xs muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
        <p className="mt-3 text-sm muted">An administrator can change your name, email or role under Staff and roles.</p>
      </section>
      <section className="card p-6"><h2 className="mb-4 text-xl">Change password</h2><PasswordForm home="/staff" /></section>
    </div>
  );
}
