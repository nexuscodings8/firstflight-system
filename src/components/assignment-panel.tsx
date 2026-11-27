import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decideRequest, directAssign, unassign } from "@/app/staff/assignment-actions";
import { dateTime } from "@/lib/format";
import { ActionForm } from "./action-form";

/** Consultant, pending requests and assignment history for one application. Admins can change the assignment here. */
export async function AssignmentPanel({ app, admin }: { app: { id: string; service: string; status: string; consultantId: string | null }; admin: boolean }) {
  const [hist, reqs, consultants] = await Promise.all([
    db.query.assignmentHistory.findMany({ where: eq(s.assignmentHistory.applicationId, app.id), orderBy: [desc(s.assignmentHistory.createdAt)], with: { from: { columns: { name: true } }, to: { columns: { name: true } }, changedBy: { columns: { name: true } } } }),
    admin ? db.query.assignmentRequests.findMany({ where: eq(s.assignmentRequests.applicationId, app.id), orderBy: [asc(s.assignmentRequests.createdAt)], with: { consultant: { columns: { name: true } } } }) : [],
    admin ? db.select({ id: s.users.id, name: s.users.name }).from(s.users).innerJoin(s.consultantServices, eq(s.consultantServices.userId, s.users.id)).where(eq(s.consultantServices.service, app.service)) : [],
  ]);
  const pending = reqs.filter((r) => r.status === "PENDING");
  return (
    <section id="assignment" className="card p-6" aria-labelledby="as-h">
      <h2 id="as-h" className="text-xl">Assignment</h2>
      {admin && app.status === "ACTIVE" && (
        <div className="mt-3 grid gap-4">
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl bg-blue-50 p-3 text-sm">
              <p><strong>{r.consultant.name}</strong> asked to serve this client ({dateTime(r.createdAt)}){r.note ? `: “${r.note}”` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <ActionForm action={decideRequest} submit="Approve request" className="grid" buttonClass="btn-primary btn-sm"><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
                <ActionForm action={decideRequest} submit="Reject" className="flex flex-wrap gap-2" buttonClass="btn-ghost btn-sm"><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="reject" /><label className="sr-only" htmlFor={`pr-${r.id}`}>Reason</label><input id={`pr-${r.id}`} name="note" className="input min-h-9 py-1 text-sm" placeholder="Reason" /></ActionForm>
              </div>
            </div>
          ))}
          <ActionForm action={directAssign} submit={app.consultantId ? "Reassign" : "Assign"} resetOnSuccess={false} className="flex flex-wrap items-end gap-2" buttonClass="btn-primary btn-sm">
            <input type="hidden" name="applicationId" value={app.id} />
            <div><label className="label" htmlFor="as-k">Consultant</label><select id="as-k" name="consultantId" defaultValue={app.consultantId ?? ""} required className="input min-h-10 py-1.5"><option value="" disabled>Choose…</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            {app.consultantId && <div className="min-w-56 flex-1"><label className="label" htmlFor="as-r">Reason for reassigning</label><input id="as-r" name="reason" className="input min-h-10 py-1.5" /></div>}
          </ActionForm>
          {app.consultantId && (
            <details><summary className="cursor-pointer text-sm text-red-700">Remove the consultant</summary>
              <ActionForm action={unassign} submit="Remove and make the client available" className="mt-2 flex flex-wrap items-start gap-2" buttonClass="btn-ghost btn-sm"><input type="hidden" name="applicationId" value={app.id} /><label className="sr-only" htmlFor="un-r">Reason</label><input id="un-r" name="reason" className="input min-h-9 flex-1 py-1 text-sm" placeholder="Reason" /></ActionForm>
            </details>
          )}
        </div>
      )}
      <h3 className="mt-4 text-base">History</h3>
      <ol className="mt-1 space-y-1 text-sm">
        {hist.map((h) => <li key={h.id}><span className="muted">{dateTime(h.createdAt)}</span> · {h.kind === "UNASSIGNED" ? `Removed from ${h.from?.name}` : `${h.from ? `${h.from.name} → ` : ""}${h.to?.name}`}{h.kind === "REQUEST_APPROVED" ? " (request approved)" : ""}{h.reason ? ` · ${h.reason}` : ""}{h.changedBy ? ` · by ${h.changedBy.name}` : ""}</li>)}
      </ol>
      {!hist.length && <p className="text-sm muted">Not assigned yet.</p>}
    </section>
  );
}
