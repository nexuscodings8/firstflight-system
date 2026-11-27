// Service contract and amendments on one application: what's signed, how, and what to do next.
import Link from "next/link";
import { uploadSignedContract } from "@/app/contract-actions";
import type { FullApplication } from "@/lib/applications";
import { paymentFacts } from "@/lib/stage-rules";
import type { FeePlan } from "@/lib/fees";
import { date, dateTime } from "@/lib/format";
import { ActionForm } from "./action-form";
import { AmendmentsSection } from "./amendments-section";

export function ContractPanel({ app, mode, canWork = false, role, seeMoney = mode === "client" }: { app: FullApplication; mode: "client" | "staff"; canWork?: boolean; role?: string; seeMoney?: boolean }) {
  const plan = app.feePlan as FeePlan | null;
  const { firstPaid } = paymentFacts(app.invoices, plan?.installments[0]?.invoiceId ?? null);
  const signed = app.contracts.filter((c) => c.kind === "CONTRACT");
  const amendments = app.contracts.filter((c) => c.kind === "AMENDMENT");
  const open = app.status === "ACTIVE";
  return (
    <section id="contract" className="card p-6" aria-labelledby="ct-h">
      <h2 id="ct-h" className="text-xl">Service contract</h2>
      {signed.length === 0 && (
        !firstPaid ? (
          <p className="mt-2 text-sm muted">{mode === "client" ? "Your contract unlocks as soon as Finance approves your first instalment." : "Locked until Finance approves the first instalment."}</p>
        ) : !open ? (
          <p className="mt-2 text-sm muted">This application is closed.</p>
        ) : mode === "client" ? (
          <div className="mt-3 rounded-xl border-2 border-gold bg-gold/10 p-4">
            <p className="font-semibold">Your contract is ready to sign.</p>
            <p className="mt-1 text-sm">Read it and sign online now, or sign a paper copy at the FIRST FLIGHT office.</p>
            <Link href={`/portal/applications/${app.id}/contract`} className="btn-gold btn-sm mt-3">Read and sign the contract</Link>
          </div>
        ) : (
          <p className="mt-2 text-sm">Waiting for the client to sign online{canWork ? ", or upload the paper copy they signed at the office below." : "."}</p>
        )
      )}
      {[...signed, ...amendments].length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {[...signed, ...amendments].map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{c.title}{c.version ? <span className="ml-2 text-xs muted">version {c.version}</span> : null}</p>
                <p className="text-sm muted">{c.method === "ONLINE" ? `Signed online by ${c.signedName} on ${dateTime(c.signedAt)}` : `Paper copy signed ${date(c.signedAt)}, uploaded by ${c.uploadedBy?.name ?? "staff"} on ${date(c.createdAt)}`}</p>
              </div>
              <div className="flex gap-2">
                <a className="btn-ghost btn-sm" href={`/api/files/contract/${c.id}?inline=1`} target="_blank" rel="noopener">View</a>
                <a className="btn-ghost btn-sm" href={`/api/files/contract/${c.id}`}>Download</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {mode === "staff" && canWork && open && firstPaid && signed.length === 0 && (
        <details className="mt-4 rounded-xl bg-mist p-4">
          <summary className="cursor-pointer font-semibold text-brand">Upload a contract signed at the office</summary>
          <ActionForm action={uploadSignedContract} submit="Upload signed contract" className="mt-3 grid gap-3">
            <input type="hidden" name="applicationId" value={app.id} />
            <label className="grid gap-1 text-sm"><span className="font-semibold">Date the client signed</span><input type="date" name="signedOn" required className="input" /></label>
            <label className="grid gap-1 text-sm"><span className="font-semibold">Scan of the signed contract (PDF, JPG or PNG)</span><input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required className="input" /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1" /> I confirm the client signed this copy in person.</label>
          </ActionForm>
        </details>
      )}
      <AmendmentsSection app={app} mode={mode} canWork={canWork} role={role} seeMoney={seeMoney} />
    </section>
  );
}
