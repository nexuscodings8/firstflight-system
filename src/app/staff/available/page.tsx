import Link from "next/link";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { STAGE_LABEL, SERVICE_LABEL, date, dateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { requestToServe, withdrawRequest } from "../assignment-actions";

export const metadata = { title: "Available clients" };

export default async function Available() {
  const me = await requireUser(["CONSULTANT"], "/staff/available");
  // Flight requests are enquiries, not applications, so only these three services have clients to serve here.
  const services = (me.services ?? []).filter((x): x is "WORK" | "STUDY" | "VISA" => x === "WORK" || x === "STUDY" || x === "VISA");
  const apps = services.length ? await db.query.applications.findMany({
    where: and(isNull(s.applications.consultantId), eq(s.applications.status, "ACTIVE"), inArray(s.applications.service, services)),
    orderBy: [asc(s.applications.createdAt)], columns: { id: true, reference: true, service: true, stage: true, createdAt: true, selection: true },
    with: { client: { columns: { name: true } }, assignmentRequests: { orderBy: [desc(s.assignmentRequests.createdAt)] } },
  }) : [];
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Available clients</h1><p className="mt-1 max-w-2xl muted">Clients without a consultant, for the services you handle ({services.map((x) => SERVICE_LABEL[x]).join(", ") || "none yet"}). Ask to serve one; an administrator approves the request before the client is yours.</p></div>
      {apps.map((a) => {
        const mine = a.assignmentRequests.find((r) => r.consultantId === me.id);
        const others = a.assignmentRequests.filter((r) => r.status === "PENDING" && r.consultantId !== me.id).length;
        const status = mine?.status === "PENDING" ? ["Request pending", "bg-blue-50 text-brand"] : mine?.status === "REJECTED" ? ["Request rejected", "bg-red-50 text-red-700"] : ["Unassigned", "bg-amber-50 text-amber-800"];
        return (
          <article key={a.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{a.client.name} · {a.reference}</p><p className="text-sm muted">{SERVICE_LABEL[a.service]} · {(a.selection as { title: string }).title} · submitted {date(a.createdAt)} · {STAGE_LABEL[a.stage]}</p></div>
              <span className={`badge ${status[1]}`}>{status[0]}</span>
            </div>
            {mine?.status === "REJECTED" && mine.note && <p className="mt-2 text-sm"><span className="muted">Administrator:</span> {mine.note} <span className="muted">({dateTime(mine.decidedAt ?? mine.createdAt)})</span></p>}
            {others > 0 && <p className="mt-2 text-sm muted">{others} other consultant{others === 1 ? " has" : "s have"} also asked. The administrator decides.</p>}
            <div className="mt-3">
              {mine?.status === "PENDING"
                ? <ActionForm action={withdrawRequest} submit="Withdraw my request" className="grid" buttonClass="btn-ghost btn-sm"><input type="hidden" name="requestId" value={mine.id} /></ActionForm>
                : <ActionForm action={requestToServe} submit="Request to serve client" className="flex flex-wrap items-start gap-2" buttonClass="btn-primary btn-sm">
                    <input type="hidden" name="applicationId" value={a.id} />
                    <label className="sr-only" htmlFor={`rn-${a.id}`}>Note for the administrator (optional)</label>
                    <input id={`rn-${a.id}`} name="note" className="input min-h-9 flex-1 py-1.5 text-sm" placeholder="Note for the administrator (optional)" maxLength={500} />
                  </ActionForm>}
            </div>
          </article>
        );
      })}
      {!apps.length && <Empty title="No unassigned clients for your services">New clients appear here as soon as they apply. <Link className="text-brand underline" href="/staff/applications">See my applications</Link>.</Empty>}
    </div>
  );
}
