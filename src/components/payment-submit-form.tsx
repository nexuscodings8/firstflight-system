"use client";
import { startTransition, useActionState, useState } from "react";
import { submitPayment } from "@/app/portal/payment-actions";

/** Client form: "I've paid this invoice" with proof, or a loan arrangement. */
export function PaymentSubmitForm({ invoiceId, number, currency, due }: { invoiceId: string; number: string; currency: string; due: string }) {
  const [state, run, pending] = useActionState(submitPayment, undefined);
  const [loan, setLoan] = useState(false);
  const [method, setMethod] = useState("MOBILE_MONEY");
  if (state?.ok) return <p role="status" className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{state.ok}</p>;
  const id = (k: string) => `${k}-${invoiceId}`;
  return (
    <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div><label className="label" htmlFor={id("amt")}>Amount paid ({currency})</label><input id={id("amt")} name="amount" inputMode="decimal" defaultValue={due} className="input" required /></div>
      <div><label className="label" htmlFor={id("m")}>How you paid</label><select id={id("m")} name="method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash at the office</option><option value="CARD">Card</option></select></div>
      <div><label className="label" htmlFor={id("ref")}>Transaction reference</label><input id={id("ref")} name="reference" className="input" required maxLength={80} placeholder={method === "CASH" ? "Office cash receipt number" : "From your SMS or bank slip"} /></div>
      <div><label className="label" htmlFor={id("d")}>Date paid</label><input id={id("d")} name="paidAt" type="date" className="input" required /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("p")}>Proof of payment (screenshot, slip or receipt: PDF, JPG or PNG){method === "CASH" ? " (optional for cash)" : ""}</label><input id={id("p")} name="proof" type="file" accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-semibold file:text-brand" /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="loanFunded" checked={loan} onChange={(e) => setLoan(e.target.checked)} className="size-4 accent-brand" /> This payment is funded by a loan</label>
      {loan && <>
        <div><label className="label" htmlFor={id("lp")}>Bank or lender</label><input id={id("lp")} name="loanProvider" className="input" required maxLength={120} /></div>
        <div><label className="label" htmlFor={id("ld")}>Loan approval document</label><input id={id("ld")} name="loanDoc" type="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:font-semibold file:text-brand" /></div>
      </>}
      <div className="sm:col-span-2"><label className="label" htmlFor={id("n")}>Note for Finance (optional)</label><input id={id("n")} name="note" className="input" maxLength={500} /></div>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button className="btn-primary btn-sm" disabled={pending}>{pending ? "Sending…" : `Submit payment for ${number}`}</button></div>
    </form>
  );
}
