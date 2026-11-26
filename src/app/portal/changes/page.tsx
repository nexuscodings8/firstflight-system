import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps } from "@/lib/client-data";
import { date } from "@/lib/format";
import { AMENDMENT_KINDS, AMENDMENT_STATUS } from "@/lib/requests";
import { Empty } from "@/components/cards";

export const metadata = { title: "Service amendments" };

export default async function Changes() {
  const user = await requireUser(["CLIENT"], "/portal/changes");
  const apps = await clientApps(user.id);
  const rows = apps.flatMap((a) => a.amendments.map((m) => ({ m, a })));
  const active = apps.filter((a) => a.status === "ACTIVE");
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Service amendments</h1><p className="mt-1 max-w-2xl muted">Ask to change your listing, personal details or dates. Your consultant approves or declines each request and explains what happens next.</p></div>
      <ul className="grid gap-3">
        {rows.map(({ m, a }) => (
          <li key={m.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{AMENDMENT_KINDS[m.kind as keyof typeof AMENDMENT_KINDS] ?? m.kind}</p><p className="text-sm muted"><Link className="text-brand underline" href={`/portal/applications/${a.id}`}>{a.reference}</Link> · asked {date(m.createdAt)}</p></div>
              <span className={`badge ${AMENDMENT_STATUS[m.status][1]}`}>{AMENDMENT_STATUS[m.status][0]}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{m.details}</p>
            {m.decisionNote && <p className="mt-2 rounded-lg bg-mist px-3 py-2 text-sm"><span className="font-semibold">Answer:</span> {m.decisionNote}</p>}
          </li>
        ))}
      </ul>
      {!rows.length && <Empty title="No change requests" />}
      {active.length > 0 && <p className="text-sm muted">To ask for a change, open the application and choose <strong>Ask to change something</strong>: {active.map((a, i) => <span key={a.id}>{i ? ", " : ""}<Link className="font-semibold text-brand underline" href={`/portal/applications/${a.id}#rq-h`}>{a.reference}</Link></span>)}.</p>}
    </div>
  );
}
