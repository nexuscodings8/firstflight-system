import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { AMEND_STATE } from "@/lib/amendments";
import { AMENDMENT_KINDS } from "@/lib/requests";
import { date, money } from "@/lib/format";
import { Empty } from "@/components/cards";

export const metadata = { title: "Contract amendments" };

export default async function Amendments() {
  const user = await requireUser(["FINANCE", "ADMIN"], "/staff/amendments");
  const states = user.role === "FINANCE" ? ["PENDING_FINANCE"] : ["PENDING_FINANCE", "PENDING_APPROVAL", "AWAITING_SIGNATURE"];
  const rows = await db.query.amendmentRequests.findMany({ where: and(eq(s.amendmentRequests.source, "STAFF"), inArray(s.amendmentRequests.state, states)), orderBy: [desc(s.amendmentRequests.createdAt)], limit: 100,
    with: { application: { columns: { id: true, reference: true, feePlan: true }, with: { client: { columns: { name: true } } } } } });
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Contract amendments</h1><p className="mt-1 max-w-2xl text-sm muted">Drafted by the consultant → Finance confirms any fee change → an administrator approves → the client signs online. Open the application to decide.</p></div>
      <ul className="grid gap-3">
        {rows.map((a) => {
          const [t, cls] = AMEND_STATE[a.state ?? ""] ?? [a.state, "bg-mist"];
          const plan = a.application.feePlan as { currency?: string } | null;
          return (
            <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-semibold">{a.application.reference} · {a.application.client.name}</p>
                <p className="text-sm muted">{AMENDMENT_KINDS[a.kind as keyof typeof AMENDMENT_KINDS] ?? a.kind} · drafted {date(a.createdAt)}{a.newFeeAmount ? ` · new fee ${money(a.newFeeAmount, plan?.currency ?? "USD")}` : ""}</p>
              </div>
              <div className="flex items-center gap-3"><span className={`badge ${cls}`}>{t}</span><Link className="btn-primary btn-sm" href={`/staff/applications/${a.application.id}#amendments`}>Open</Link></div>
            </li>
          );
        })}
      </ul>
      {!rows.length && <Empty title="No amendments waiting" />}
    </div>
  );
}
