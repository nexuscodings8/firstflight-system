import Link from "next/link";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { assignToMyself } from "../assignment-actions";

export const metadata = { title: "Available clients" };

export default async function Available() {
  const me = await requireUser(["CONSULTANT"], "/staff/available");
  // Flight requests are enquiries, not applications, so only these three services have clients to serve here.
  const services = (me.services ?? []).filter((x): x is "WORK" | "STUDY" | "VISA" => x === "WORK" || x === "STUDY" || x === "VISA");
  const apps = services.length ? await db.query.applications.findMany({
    where: and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE"), inArray(s.applications.service, services)),
    orderBy: [asc(s.applications.createdAt)], columns: { id: true, reference: true, service: true, stage: true, createdAt: true, selection: true, origin: true },
    with: { client: { columns: { name: true } } },
  }) : [];
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Available clients</h1><p className="mt-1 max-w-2xl muted">Clients without a consultant, for the services you handle ({services.map((x) => SERVICE_LABEL[x]).join(", ") || "none yet"}). Choose <strong>Assign to myself</strong> to take one. Once assigned, the client stays yours until an administrator changes it.</p></div>
      {apps.map((a) => (
        <article key={a.id} className="card p-5" data-testid="available-client">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold">{a.client.name} · {a.reference}</p>
              <p className="text-sm muted">{SERVICE_LABEL[a.service]} · {(a.selection as { title: string }).title} · submitted {date(a.createdAt)} · {STAGE_LABEL[a.stage]}{a.origin === "EXISTING" ? " · existing client (served before the platform)" : ""}</p></div>
            <span className="badge bg-amber-50 text-amber-800">Unassigned</span>
          </div>
          <ActionForm action={assignToMyself} submit="Assign to myself" className="mt-3 grid" buttonClass="btn-primary btn-sm justify-self-start"><input type="hidden" name="applicationId" value={a.id} /></ActionForm>
        </article>
      ))}
      {!apps.length && <Empty title="No unassigned clients for your services">New clients appear here as soon as they apply. <Link className="text-brand underline" href="/staff/applications">See my applications</Link>.</Empty>}
    </div>
  );
}
