import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { date } from "@/lib/format";
import { PasswordForm } from "@/components/password-form";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Profile and settings" };

export default async function Profile() {
  const me = await requireUser(["CLIENT"], "/portal/profile");
  const u = (await db.query.users.findFirst({ where: eq(s.users.id, me.id), columns: { name: true, email: true, phone: true, createdAt: true } }))!;
  return (
    <div className="grid max-w-3xl gap-5">
      <h1 className="text-[clamp(26px,3vw,36px)]">Profile and settings</h1>
      <section className="card p-6">
        <h2 className="text-xl">Your details</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {[["Full name", u.name], ["Email", u.email], ["Phone", u.phone ?? "Not given"], ["Client since", date(u.createdAt)]].map(([k, v]) => <div key={k} className="rounded-xl bg-mist p-3"><dt className="text-xs muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm muted">To change your name, email or phone, ask your consultant or contact {COMPANY.email}, so your applications stay matched to you.</p>
      </section>
      <section className="card p-6"><h2 className="mb-4 text-xl">Change password</h2><PasswordForm home="/portal" /></section>
    </div>
  );
}
