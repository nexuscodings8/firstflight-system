import Link from "next/link";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateTime, label } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/cards";
import { assignEnquiry, closeEnquiry, reopenEnquiry } from "./actions";

export const metadata = { title: "Enquiries" };

/** Turns the saved page context (program, job, visa inputs) into readable pairs. */
function contextPairs(ctx: unknown): [string, string][] {
  if (!ctx || typeof ctx !== "object") return [];
  const c = ctx as Record<string, unknown>, out: [string, string][] = [];
  if (c.source === "assistant") out.push(["Via", "Website assistant"]);
  if (typeof c.page === "string" && c.page) out.push(["From page", c.page]);
  for (const [k, l] of [["program", "Program"], ["university", "University"], ["job", "Job"], ["country", "Country"]] as const) if (typeof c[k] === "string") out.push([l, c[k] as string]);
  if (c.visa && typeof c.visa === "object") for (const [k, v] of Object.entries(c.visa as Record<string, unknown>)) if (typeof v === "string" && v) out.push([label(k.replace(/([A-Z])/g, "_$1").toUpperCase()), v]);
  return out.slice(0, 10);
}

const TABS = { open: "Open", mine: "Mine", new: "New", closed: "Closed" } as const;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser(["ADMIN", "CONSULTANT"], "/staff/enquiries");
  const show = ((await searchParams).show ?? "open") as keyof typeof TABS;
  const where: SQL | undefined =
    show === "mine" ? and(eq(s.enquiries.assignedToId, user.id), inArray(s.enquiries.status, ["NEW", "IN_PROGRESS"]))
      : show === "new" ? eq(s.enquiries.status, "NEW")
        : show === "closed" ? eq(s.enquiries.status, "CLOSED")
          : inArray(s.enquiries.status, ["NEW", "IN_PROGRESS"]);
  const [rows, consultants] = await Promise.all([
    db.query.enquiries.findMany({ where, orderBy: [desc(s.enquiries.createdAt)], limit: 100, with: { assignedTo: { columns: { name: true } } } }),
    user.role === "ADMIN" ? db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(inArray(s.users.role, ["CONSULTANT", "ADMIN"]), eq(s.users.active, true))) : [],
  ]);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl">Enquiries</h1>
        <nav aria-label="Filter enquiries" className="flex flex-wrap gap-1 text-sm">{(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => <Link key={k} href={`/staff/enquiries?show=${k}`} aria-current={show === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${show === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{TABS[k]}</Link>)}</nav>
      </div>
      {rows.map((e) => {
        const ctx = contextPairs(e.context);
        const mine = e.assignedToId === user.id;
        const canAct = user.role === "ADMIN" || mine;
        return (
          <article key={e.id} className="card p-5" aria-labelledby={`e-${e.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p id={`e-${e.id}`} className="font-semibold">{e.reference} · {label(e.type)} · {e.name}</p><p className="text-sm muted"><a className="text-brand underline" href={`mailto:${e.email}`}>{e.email}</a>{e.phone ? ` · ${e.phone}` : ""} · {dateTime(e.createdAt)}{e.clientId ? " · has a client account" : ""}</p></div>
              <span className={`badge ${e.status === "NEW" ? "bg-gold/30 text-ink" : e.status === "CLOSED" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-brand"}`}>{label(e.status)}{e.assignedTo ? ` · ${mine ? "you" : e.assignedTo.name}` : ""}</span>
            </div>
            <p className="mt-3 whitespace-pre-line">{e.message}</p>
            {ctx.length > 0 && <dl className="mt-3 flex flex-wrap gap-2 text-xs">{ctx.map(([k, v]) => <div key={k} className="rounded-lg bg-mist px-2.5 py-1"><dt className="inline muted">{k}: </dt><dd className="inline font-semibold">{v}</dd></div>)}</dl>}
            {typeof (e.context as { transcript?: unknown } | null)?.transcript === "string" && (e.context as { transcript: string }).transcript && (
              <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-brand">Chat with the assistant before this</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-mist p-3 font-sans text-xs">{(e.context as { transcript: string }).transcript}</pre></details>
            )}
            {e.resolution && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm"><p className="font-semibold text-emerald-800">Answer given</p><p className="whitespace-pre-line">{e.resolution}</p></div>}
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {e.status !== "CLOSED" && user.role === "CONSULTANT" && !e.assignedToId && (
                <ActionForm action={assignEnquiry} submit="Take this enquiry" className="grid gap-2"><input type="hidden" name="enquiryId" value={e.id} /></ActionForm>
              )}
              {e.status !== "CLOSED" && user.role === "ADMIN" && (
                <ActionForm action={assignEnquiry} submit={e.assignedToId ? "Reassign" : "Assign"} resetOnSuccess={false} className="flex flex-wrap items-end gap-2" buttonClass="btn-ghost btn-sm">
                  <input type="hidden" name="enquiryId" value={e.id} />
                  <div><label className="label" htmlFor={`as-${e.id}`}>Handled by</label><select id={`as-${e.id}`} name="assigneeId" defaultValue={e.assignedToId ?? user.id} className="input min-h-9 py-1 text-sm">{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </ActionForm>
              )}
              {e.status !== "CLOSED" && canAct && (
                <details className="min-w-72 flex-1 rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Record answer and close</summary>
                  <ActionForm action={closeEnquiry} submit="Close enquiry" className="mt-3 grid gap-3">
                    <input type="hidden" name="enquiryId" value={e.id} />
                    <div><label className="label" htmlFor={`rs-${e.id}`}>Answer given</label><textarea id={`rs-${e.id}`} name="resolution" rows={4} className="input" required maxLength={4000} /></div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sendToClient" className="size-4 accent-brand" defaultChecked /> Email this answer to {e.email}</label>
                  </ActionForm>
                </details>
              )}
              {e.status === "CLOSED" && canAct && <ActionForm action={reopenEnquiry} submit="Reopen" className="grid" buttonClass="btn-ghost btn-sm"><input type="hidden" name="enquiryId" value={e.id} /></ActionForm>}
            </div>
          </article>
        );
      })}
      {!rows.length && <Empty title="No enquiries here" />}
    </div>
  );
}
