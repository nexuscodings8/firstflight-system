import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { date, label } from "@/lib/format";
import type { Role } from "@/lib/permissions";
import { UserActionForm } from "@/components/user-action-form";
import { changeRole, createStaff, resetPassword, setActive } from "./actions";

export const metadata = { title: "Users" };
const ROLES: Role[] = ["ADMIN", "CONSULTANT", "FINANCE", "CONTENT_MANAGER", "CLIENT"];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const me = await requireUser(["ADMIN"], "/staff/users");
  const r = (await searchParams).role;
  const role = ROLES.includes(r as Role) ? (r as Role) : undefined;
  const users = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, phone: s.users.phone, role: s.users.role, active: s.users.active, mustChangePassword: s.users.mustChangePassword, createdAt: s.users.createdAt })
    .from(s.users).where(role ? eq(s.users.role, role) : undefined).orderBy(desc(s.users.active), sql`${s.users.role} = 'CLIENT'`, asc(s.users.role), asc(s.users.name)).limit(500);
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Users</h1>
      <section className="card p-5">
        <h2 className="text-xl">Add a staff member</h2>
        <p className="mt-1 text-sm muted">They get a temporary password and must choose their own at first sign-in. Clients create their own accounts on the website.</p>
        <UserActionForm action={createStaff} submit="Create account" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="nu-name">Full name</label><input id="nu-name" name="name" className="input" required maxLength={120} /></div>
          <div><label className="label" htmlFor="nu-email">Email</label><input id="nu-email" name="email" type="email" className="input" required /></div>
          <div><label className="label" htmlFor="nu-phone">Phone (optional)</label><input id="nu-phone" name="phone" className="input" maxLength={30} /></div>
          <div><label className="label" htmlFor="nu-role">Role</label><select id="nu-role" name="role" className="input" required defaultValue="CONSULTANT">{ROLES.filter((x) => x !== "CLIENT").map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></div>
        </UserActionForm>
      </section>
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">All accounts</h2>
          <nav aria-label="Filter by role" className="flex flex-wrap gap-1 text-sm"><Link href="/staff/users" aria-current={!role ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${!role ? "bg-brand text-white" : "hover:bg-mist"}`}>All</Link>{ROLES.map((x) => <Link key={x} href={`/staff/users?role=${x}`} aria-current={role === x ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${role === x ? "bg-brand text-white" : "hover:bg-mist"}`}>{label(x)}</Link>)}</nav>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className={`py-4 ${u.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal muted">(you)</span>}</p><p className="text-sm muted">{u.email}{u.phone ? ` · ${u.phone}` : ""} · since {date(u.createdAt)}</p></div>
                <div className="flex flex-wrap gap-1.5"><span className="badge bg-mist text-brand">{label(u.role)}</span>{!u.active && <span className="badge bg-red-50 text-red-700">Deactivated</span>}{u.mustChangePassword && <span className="badge bg-gold/25 text-ink">Temporary password</span>}{u.email.endsWith("@firstflight.test") && <span className="badge bg-slate-100 text-slate-600">Demo account</span>}</div>
              </div>
              {u.id !== me.id && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Manage {u.name}</summary>
                  <div className="mt-3 grid gap-4 rounded-xl bg-mist p-3 lg:grid-cols-3">
                    <UserActionForm action={changeRole} submit="Change role" resetOnSuccess={false} className="flex flex-wrap items-end gap-2" buttonClass="btn-ghost btn-sm">
                      <input type="hidden" name="userId" value={u.id} />
                      <div><label className="label" htmlFor={`ro-${u.id}`}>Role</label><select id={`ro-${u.id}`} name="role" defaultValue={u.role} className="input min-h-9 py-1 text-sm">{ROLES.map((x) => <option key={x} value={x}>{label(x)}</option>)}</select></div>
                    </UserActionForm>
                    <UserActionForm action={resetPassword} submit="Reset password" className="flex flex-wrap items-end gap-2" buttonClass="btn-ghost btn-sm"><input type="hidden" name="userId" value={u.id} /></UserActionForm>
                    <UserActionForm action={setActive} submit={u.active ? "Deactivate account" : "Reactivate account"} className="flex flex-wrap items-end gap-2" buttonClass={u.active ? "btn-sm btn border border-red-300 bg-white text-red-700 hover:bg-red-50" : "btn-primary btn-sm"}>
                      <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="active" value={u.active ? "false" : "true"} />
                    </UserActionForm>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
