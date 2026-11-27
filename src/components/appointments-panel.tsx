// Office appointments on one application. Consultants invite; clients accept, continue remotely or decline.
import { closeAppointment, inviteToOffice, respondToAppointment } from "@/app/appointment-actions";
import type { FullApplication } from "@/lib/applications";
import { APPT_STATUS, type OfficeSnap } from "@/lib/appointments";
import type { Office } from "@/lib/settings";
import { STAGES, STAGE_LABEL, kigaliTime } from "@/lib/format";
import { ActionForm } from "./action-form";

export function AppointmentsPanel({ app, mode, canWork = false, office }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean; office?: Office }) {
  const list = [...app.appointments].sort((a, b) => +b.startsAt - +a.startsAt);
  if (mode === "client" && !list.length) return null;
  return (
    <section id="appointments" className="card p-6" aria-labelledby="ap-h">
      <h2 id="ap-h" className="text-xl">Appointments</h2>
      {!list.length && <p className="mt-2 text-sm muted">No office appointments yet.</p>}
      <ul className="mt-3 space-y-3">
        {list.map((a) => {
          const o = a.office as OfficeSnap;
          const [txt, cls] = APPT_STATUS[a.status] ?? [a.status, "bg-mist"];
          return (
            <li key={a.id} className="rounded-xl border border-line p-4" data-testid="appointment">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{kigaliTime(a.startsAt)}</p><p className="text-sm muted">With {a.consultant.name}</p></div>
                <span className={`badge ${cls}`}>{txt}</span>
              </div>
              <p className="mt-2 text-sm"><span className="font-semibold">Why:</span> {a.reason}</p>
              {a.expectedStage && <p className="text-sm"><span className="font-semibold">Next stage after the visit:</span> {STAGE_LABEL[a.expectedStage]}</p>}
              <p className="mt-1 text-sm"><span className="font-semibold">Where:</span> {o.address} · <a className="text-brand underline" href={o.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>
              <p className="text-sm muted">{o.phone} · {o.hours}</p>
              {a.clientNote && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Client&apos;s note:</span> {a.clientNote}</p>}
              {mode === "client" && a.status === "PENDING" && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ActionForm action={respondToAppointment} submit="Accept and visit the office" buttonClass="btn-primary btn-sm" className="grid">
                    <input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="choice" value="accept" />
                  </ActionForm>
                  {a.remoteAllowed && (
                    <ActionForm action={respondToAppointment} submit="Continue remotely" buttonClass="btn-ghost btn-sm" className="grid">
                      <input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="choice" value="remote" />
                    </ActionForm>
                  )}
                  <ActionForm action={respondToAppointment} submit="Decline" buttonClass="btn-ghost btn-sm justify-self-start" className="grid gap-2">
                    <input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="choice" value="decline" />
                    <label className="sr-only" htmlFor={`dn-${a.id}`}>Reason or another time</label>
                    <input id={`dn-${a.id}`} name="note" className="input text-sm" placeholder="Why, or suggest another time" />
                  </ActionForm>
                </div>
              )}
              {mode === "staff" && canWork && ["PENDING", "ACCEPTED", "REMOTE"].includes(a.status) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status !== "PENDING" && <ActionForm action={closeAppointment} submit="Mark completed" className="grid"><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="action" value="complete" /></ActionForm>}
                  {a.status !== "REMOTE" && <ActionForm action={closeAppointment} submit="Cancel appointment" buttonClass="btn-ghost btn-sm" className="grid"><input type="hidden" name="appointmentId" value={a.id} /><input type="hidden" name="action" value="cancel" /></ActionForm>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {mode === "staff" && canWork && app.status === "ACTIVE" && app.consultantId && office && (
        <details className="mt-4 rounded-xl bg-mist p-4">
          <summary className="cursor-pointer font-semibold text-brand">Invite the client to the office</summary>
          {!office.confirmed && <p className="mt-2 rounded-lg bg-gold/20 p-2 text-sm">The office address hasn&apos;t been confirmed by an administrator yet (Settings → Office). Check it before inviting: {office.address}</p>}
          <ActionForm action={inviteToOffice} submit="Send invitation" className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="grid gap-1 text-sm sm:col-span-2"><span className="font-semibold">Why they should come</span><textarea name="reason" rows={2} required className="input" placeholder="e.g. Sign your working documents and bring your original passport" /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Date</span><input type="date" name="date" required className="input" /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Time (Kigali)</span><input type="time" name="time" required className="input" /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Next stage after the visit (optional)</span>
              <select name="expectedStage" className="input"><option value="">Not specified</option>{STAGES.filter((x) => x !== "SUBMITTED").map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remoteAllowed" /> The client may continue remotely instead</label>
            <p className="text-xs muted sm:col-span-2">The invitation includes {office.address} and its Google Maps link.</p>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
