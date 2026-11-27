// The refund / reapplication form: the client's online version, or the staff version for a signed paper form.
import { submitRefund } from "@/app/portal/request-actions";
import { recordPaperRefund } from "@/app/staff/finance/refund-actions";
import { balanceOf, fromCents } from "@/lib/finance";
import { money } from "@/lib/format";
import { ActionForm } from "./action-form";

type Inv = { id: string; number: string; description: string; currency: string; amount: string; status: string; payments: { amount: string }[] };

export function RefundForm({ applicationId, invoices, allowReapplication, refundOpen, mode, clientName }: { applicationId: string; invoices: Inv[]; allowReapplication: boolean; refundOpen: boolean; mode: "client" | "paper"; clientName: string }) {
  const paid = invoices.filter((i) => i.payments.length);
  const id = (k: string) => `${mode}-${k}-${applicationId}`;
  return (
    <ActionForm action={mode === "client" ? submitRefund : recordPaperRefund} submit={mode === "client" ? "Sign and submit" : "Record the paper form"} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset className="sm:col-span-2"><legend className="label">What are you asking for?</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {refundOpen && <label className="flex items-center gap-2"><input type="radio" name="kind" value="REFUND" defaultChecked /> A refund of money paid</label>}
          {allowReapplication && <label className="flex items-center gap-2"><input type="radio" name="kind" value="REAPPLICATION" defaultChecked={!refundOpen} /> Reapply instead of a refund (keep what was paid)</label>}
        </div>
      </fieldset>
      <div className="sm:col-span-2"><label className="label" htmlFor={id("reason")}>Reason</label><textarea id={id("reason")} name="reason" rows={3} className="input" required maxLength={2000} /></div>
      {refundOpen && <>
        <p className="text-xs muted sm:col-span-2">For a refund, fill in the payment and how to pay {mode === "client" ? "you" : "the client"}. Leave these as they are for a reapplication.</p>
        <div><label className="label" htmlFor={id("inv")}>Payment to refund</label><select id={id("inv")} name="invoiceId" className="input">{paid.map((i) => <option key={i.id} value={i.id}>{i.number}: {i.description} ({money(fromCents(balanceOf({ ...i, status: "ISSUED" }).paid), i.currency)} paid)</option>)}</select></div>
        <div><label className="label" htmlFor={id("amt")}>Amount asked for</label><input id={id("amt")} name="amount" inputMode="decimal" className="input" defaultValue={paid[0] ? fromCents(balanceOf({ ...paid[0], status: "ISSUED" }).paid) : ""} /></div>
        <div><label className="label" htmlFor={id("pref")}>Payment reference you paid with (optional)</label><input id={id("pref")} name="paymentReference" className="input" maxLength={80} /></div>
        <div><label className="label" htmlFor={id("m")}>Refund by</label><select id={id("m")} name="method" className="input" defaultValue="MOBILE_MONEY"><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option></select></div>
        <div><label className="label" htmlFor={id("an")}>Name on the account</label><input id={id("an")} name="accountName" className="input" maxLength={120} /></div>
        <div><label className="label" htmlFor={id("ad")}>Mobile money number, or bank and account number</label><input id={id("ad")} name="accountDetails" className="input" maxLength={300} /></div>
      </>}
      {mode === "client" ? <>
        <div className="sm:col-span-2"><label className="label" htmlFor={id("sup")}>Supporting document (optional: PDF, JPG or PNG)</label><input id={id("sup")} name="supporting" type="file" accept="application/pdf,image/jpeg,image/png" className="input" /></div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="declaration" className="mt-1 size-4 accent-brand" /> I confirm this information is correct and any account given is mine.</label>
        <div className="sm:col-span-2"><label className="label" htmlFor={id("sig")}>Type your full name to sign</label><input id={id("sig")} name="declarationName" className="input" placeholder={clientName} required maxLength={120} /></div>
      </> : <>
        <div className="sm:col-span-2"><label className="label" htmlFor={id("form")}>Scan of the signed paper form (PDF, JPG or PNG)</label><input id={id("form")} name="form" type="file" accept="application/pdf,image/jpeg,image/png" required className="input" /></div>
        <div><label className="label" htmlFor={id("sig")}>Name the client signed with</label><input id={id("sig")} name="declarationName" className="input" defaultValue={clientName} maxLength={120} /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1 size-4 accent-brand" /> The client filled in and signed this form.</label>
      </>}
    </ActionForm>
  );
}
