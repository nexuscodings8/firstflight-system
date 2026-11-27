import { money } from "@/lib/format";

/** Public service-fee line: the total only. Instalment plans are shown to the client after they apply. */
export function PublicFee({ fee }: { fee: { amount: string; currency: string } | null }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-mist/60 p-4" data-testid="public-fee">
      <p className="text-sm muted">FIRST FLIGHT service fee</p>
      {fee ? <p className="text-2xl font-bold text-brand">{money(fee.amount, fee.currency)}</p> : <p className="font-semibold">Ask a consultant for the fee</p>}
      <p className="mt-1 text-xs muted">{fee ? "Total fee. How it's split into payments is agreed when you apply." : "We'll confirm the fee for your case before you pay anything."}</p>
    </div>
  );
}
