import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps } from "@/lib/client-data";
import { balanceOf, fromCents } from "@/lib/finance";
import { money } from "@/lib/format";
import { BoardingPass, PaidBar } from "@/components/boarding-pass";
import { Empty } from "@/components/cards";

export const metadata = { title: "My applications" };

export default async function MyApplications() {
  const user = await requireUser(["CLIENT"], "/portal/applications");
  const apps = await clientApps(user.id);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-[clamp(26px,3vw,36px)]">My applications</h1><Link href="/portal/new" className="btn-primary btn-sm">New application</Link></div>
      {apps.map((a) => {
        const inv = a.invoices.filter((i) => i.status !== "VOID");
        const cur = inv[0]?.currency;
        const paid = inv.reduce((n, i) => n + balanceOf(i).paid, 0), total = inv.reduce((n, i) => n + balanceOf(i).total, 0);
        const need = a.checklist.filter((c) => c.mandatory && ["PENDING", "REQUESTED", "REJECTED"].includes(c.state)).length;
        return (
          <div key={a.id} className="grid gap-1.5">
            <BoardingPass app={a} href={`/portal/applications/${a.id}`} stub={inv.length && inv.every((i) => i.currency === cur) ? <PaidBar paid={paid} total={total} text={`${money(fromCents(paid), cur)} of ${money(fromCents(total), cur)}`} /> : <span className="muted">No fees issued yet</span>} />
            {need > 0 && a.status === "ACTIVE" && <p className="text-sm font-semibold text-amber-800">{need} required document{need === 1 ? "" : "s"} to upload</p>}
          </div>
        );
      })}
      {!apps.length && <Empty title="No applications yet">Start one from <Link className="text-brand underline" href="/portal/new">New application</Link>.</Empty>}
    </div>
  );
}
