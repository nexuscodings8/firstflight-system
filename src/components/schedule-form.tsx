"use client";
import { useState } from "react";
import { confirmSchedule } from "@/app/staff/finance/fee-actions";
import { STAGE_LABEL } from "@/lib/format";
import { MAX_INSTALMENTS, STAGE_CONDITIONS, needsOffer } from "@/lib/schedule";
import { ActionForm } from "./action-form";

type R = { label: string; amount: string; condition: string; dueDays: number; loanEligible: boolean; historical: boolean; locked: boolean; invoiceNumber: string | null };

/** Finance/Admin editor for one application's instalment schedule. Instalments already invoiced are locked. */
export function ScheduleForm({ applicationId, service, currency, total, rows: initial, confirmed, existingClient, currencies, lockedPrice }: {
  applicationId: string; service: string; currency: string; total: string; rows: R[]; confirmed: boolean; existingClient: boolean; currencies: readonly string[]; lockedPrice: string | null;
}) {
  const [rows, setRows] = useState<R[]>(initial.length ? initial : [{ label: "Deposit", amount: total, condition: "INITIAL", dueDays: 7, loanEligible: false, historical: false, locked: false, invoiceNumber: null }]);
  const [tot, setTot] = useState(total);
  const cents = (v: string) => Math.round(Number(v || 0) * 100);
  const sum = rows.reduce((t, r) => t + cents(r.amount), 0);
  const diff = cents(tot) - sum;
  const set = (i: number, p: Partial<R>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const conds: [string, string][] = [["INITIAL", "At initial invoicing (now)"], ...STAGE_CONDITIONS.map((st): [string, string] => [`STAGE:${st}`, `When the application reaches ${STAGE_LABEL[st]}`]), ...(needsOffer(service) ? [["OFFER_LETTER", "After the offer letter is received"] as [string, string]] : []), ["VISA", "After the visa is issued"]];
  const splitEvenly = () => {
    const free = rows.filter((r) => !r.locked), lockedSum = rows.filter((r) => r.locked).reduce((t, r) => t + cents(r.amount), 0);
    const each = Math.floor((cents(tot) - lockedSum) / Math.max(free.length, 1));
    let k = 0;
    setRows(rows.map((r) => { if (r.locked) return r; k++; const v = k === free.length ? cents(tot) - lockedSum - each * (free.length - 1) : each; return { ...r, amount: (v / 100).toFixed(2) }; }));
  };
  return (
    <ActionForm action={confirmSchedule} submit={confirmed ? "Save schedule changes" : "Confirm schedule and issue the first invoice"} className="mt-3 grid gap-3" resetOnSuccess={false}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="count" value={rows.length} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="sch-total">Total agreed service fee</label>
          <input id="sch-total" name="total" inputMode="decimal" className="input" value={tot} onChange={(e) => setTot(e.target.value)} readOnly={confirmed} /></div>
        <div><label className="label" htmlFor="sch-cur">Currency</label>
          <select id="sch-cur" name="currency" className="input" defaultValue={currency} disabled={confirmed}>{currencies.map((c) => <option key={c}>{c}</option>)}</select>
          {confirmed && <input type="hidden" name="currency" value={currency} />}</div>
        <div className="self-end text-sm">{lockedPrice && <p className="muted">Price locked when the client applied: <strong>{lockedPrice}</strong></p>}
          <p className={diff === 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"} aria-live="polite" data-testid="schedule-sum">{diff === 0 ? "Instalments add up to the total." : `Instalments add up to ${(sum / 100).toFixed(2)}: ${diff > 0 ? `${(diff / 100).toFixed(2)} short` : `${(-diff / 100).toFixed(2)} over`}.`}</p></div>
      </div>
      <ol className="grid gap-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-line bg-white p-3" data-testid="schedule-row">
            <p className="text-sm font-semibold">Instalment {i + 1}{r.locked ? ` · invoiced (${r.invoiceNumber}), can't change` : ""}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.3fr_0.8fr_1.6fr_0.6fr]">
              <div><label className="label" htmlFor={`sl-${i}`}>Name</label><input id={`sl-${i}`} name={`label${i}`} className="input" value={r.label} onChange={(e) => set(i, { label: e.target.value })} readOnly={r.locked} required maxLength={80} /></div>
              <div><label className="label" htmlFor={`sa-${i}`}>Amount</label><input id={`sa-${i}`} name={`amount${i}`} inputMode="decimal" className="input" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} readOnly={r.locked} required /></div>
              <div><label className="label" htmlFor={`sc-${i}`}>Becomes payable</label>
                <select id={`sc-${i}`} name={`condition${i}`} className="input" value={r.condition} onChange={(e) => set(i, { condition: e.target.value })} disabled={r.locked}>{conds.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                {r.locked && <input type="hidden" name={`condition${i}`} value={r.condition} />}</div>
              <div><label className="label" htmlFor={`sd-${i}`}>Days to pay</label><input id={`sd-${i}`} name={`dueDays${i}`} type="number" min={0} max={365} className="input" value={r.dueDays} onChange={(e) => set(i, { dueDays: Number(e.target.value) })} readOnly={r.locked} /></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {rows.length === 3 && i === 2 && <label className="flex items-center gap-2"><input type="checkbox" name={`loan${i}`} checked={r.loanEligible} onChange={(e) => set(i, { loanEligible: e.target.checked })} /> The client may pay this final instalment with an approved loan</label>}
              {existingClient && <label className="flex items-center gap-2"><input type="checkbox" name={`historical${i}`} checked={r.historical} onChange={(e) => set(i, { historical: e.target.checked })} disabled={r.locked} /> Paid before the platform (validated from the records below)</label>}
              {!r.locked && rows.length > 1 && <button type="button" className="text-red-700 underline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {rows.length < MAX_INSTALMENTS && <button type="button" className="btn-ghost btn-sm" onClick={() => setRows([...rows, { label: `Instalment ${rows.length + 1}`, amount: "0", condition: "VISA", dueDays: 7, loanEligible: false, historical: false, locked: false, invoiceNumber: null }].map((x, j, a) => (a.length === 3 ? x : { ...x, loanEligible: false })))}>Add an instalment</button>}
        <button type="button" className="btn-ghost btn-sm" onClick={splitEvenly}>Split the rest evenly</button>
      </div>
      <p className="text-xs muted">Only instalments whose condition is met are invoiced; the others stay scheduled and are invoiced automatically when the stage is reached, the offer letter is uploaded or the visa is recorded. A loan is possible only on the third and final instalment of a three-instalment schedule.</p>
      <div><label className="label" htmlFor="sch-reason">{confirmed ? "Reason for the change (shown to the client)" : "Reason, if the total differs from the locked price"}</label><input id="sch-reason" name="reason" className="input" maxLength={300} /></div>
    </ActionForm>
  );
}
