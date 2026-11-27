import Link from "next/link";
import { and, asc, count, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { ALL_SERVICES } from "@/lib/settings";
import { SERVICE_LABEL, dateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { setServiceAccess } from "./actions";

export const metadata = { title: "Service permissions" };

export default async function Permissions() {
  await requireUser(["ADMIN"], "/staff/permissions");
  const [consultants, grants, load, log] = await Promise.all([
    db.select({ id: s.users.id, name: s.users.name, active: s.users.active }).from(s.users).where(eq(s.users.role, "CONSULTANT")).orderBy(asc(s.users.name)),
    db.select().from(s.consultantServices),
    db.select({ id: s.applications.consultantId, service: s.applications.service, n: count() }).from(s.applications).where(eq(s.applications.status, "ACTIVE")).groupBy(s.applications.consultantId, s.applications.service),
    db.query.activities.findMany({ where: and(eq(s.activities.entityType, "user")), orderBy: (a, { desc }) => [desc(a.createdAt)], limit: 60 }),
  ]);
  const permLog = log.filter((a) => a.action.startsWith("permission.")).slice(0, 15);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Service permissions</h1><p className="mt-1 max-w-2xl muted">Choose which services each consultant may handle. A consultant only sees, requests and works on clients of services ticked here. Removing a service takes effect immediately; reassign their clients under Assignments.</p></div>
      <div className="card overflow-x-auto p-2">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="border-b border-line text-xs muted"><th className="px-3 py-2">Consultant</th>{ALL_SERVICES.map((sv) => <th key={sv} className="px-3">{SERVICE_LABEL[sv]}</th>)}</tr></thead>
          <tbody>{consultants.map((c) => (
            <tr key={c.id} className={`border-b border-line align-top last:border-0 ${c.active ? "" : "opacity-60"}`}>
              <td className="px-3 py-3 font-semibold">{c.name}{!c.active && <span className="ml-1 text-xs font-normal muted">(deactivated)</span>}</td>
              {ALL_SERVICES.map((sv) => {
                const on = grants.some((g) => g.userId === c.id && g.service === sv);
                const n = load.find((l) => l.id === c.id && l.service === sv)?.n ?? 0;
                return (
                  <td key={sv} className="px-3 py-3">
                    <span className={`badge ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{on ? "Allowed" : "No access"}</span>
                    {n > 0 && <span className="ml-1 text-xs muted">{n} active</span>}
                    <ActionForm action={setServiceAccess} submit={on ? `Revoke ${SERVICE_LABEL[sv]}` : `Grant ${SERVICE_LABEL[sv]}`} className="mt-1.5 grid" buttonClass={on ? "text-xs font-semibold text-red-700 underline justify-self-start" : "text-xs font-semibold text-brand underline justify-self-start"} resetOnSuccess={false}>
                      <input type="hidden" name="userId" value={c.id} /><input type="hidden" name="service" value={sv} /><input type="hidden" name="grant" value={on ? "false" : "true"} />
                    </ActionForm>
                    {!on && n > 0 && <Link className="mt-1 block text-xs font-semibold text-amber-800 underline" href={`/staff/applications?consultant=${c.id}`}>Reassign {n}</Link>}
                  </td>
                );
              })}
            </tr>))}</tbody>
        </table>
        {!consultants.length && <Empty title="No consultants yet" />}
      </div>
      <section className="card p-5"><h2 className="text-xl">Recent permission changes</h2><ol className="mt-2 space-y-1 text-sm">{permLog.map((a) => <li key={a.id}><span className="muted">{dateTime(a.createdAt)}</span> · {a.summary}</li>)}</ol>{!permLog.length && <p className="text-sm muted">No changes yet.</p>}</section>
    </div>
  );
}
