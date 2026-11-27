import { requestLoan } from "@/app/loan-actions";
import { ActionForm } from "./action-form";

/** Client's loan-based payment request: shown only on an eligible third and final instalment. */
export function LoanRequestForm({ invoiceId, currency, due }: { invoiceId: string; currency: string; due: string }) {
  const id = (k: string) => `ln-${k}-${invoiceId}`;
  return (
    <ActionForm action={requestLoan} submit="Send loan request" className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div><label className="label" htmlFor={id("p")}>Bank or lender</label><input id={id("p")} name="provider" className="input" required maxLength={120} /></div>
      <div><label className="label" htmlFor={id("a")}>Loan amount ({currency})</label><input id={id("a")} name="amount" inputMode="decimal" defaultValue={due} className="input" required /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("d")}>Loan details (terms, when it pays out)</label><textarea id={id("d")} name="details" rows={2} className="input" required maxLength={2000} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("f")}>Loan approval or offer from the lender (PDF, JPG or PNG)</label><input id={id("f")} name="doc" type="file" required accept="application/pdf,image/jpeg,image/png" className="input" /></div>
      <p className="text-xs muted sm:col-span-2">Your instalment counts as paid only after Finance verifies and approves the loan.</p>
    </ActionForm>
  );
}
