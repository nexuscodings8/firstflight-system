import Image from "next/image";
import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { PrintButton } from "./print-button";

/** Letter-style frame shared by invoices and receipts, designed to print on one A4 page. */
export function BillingDoc({ title, number, back, children }: { title: string; number: string; back: string; children: React.ReactNode }) {
  return (
    <div className="bg-mist py-8 print:bg-white print:py-0">
      <div className="wrap max-w-3xl">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3"><Link href={back} className="text-sm font-semibold text-brand">← Back</Link><PrintButton /></div>
        <article className="card p-8 print:border-0 print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-gold pb-5">
            <div>
              <Image src="/logo-full.png" alt="FIRST FLIGHT" width={589} height={406} className="h-20 w-auto" />
              <p className="mt-2 text-sm font-semibold">{COMPANY.legalName}</p>
              <p className="text-xs muted">{COMPANY.email} · {COMPANY.phones.join(" · ")}</p>
            </div>
            <div className="text-right"><p className="font-display text-3xl font-extrabold text-brand">{title}</p><p className="font-semibold">{number}</p></div>
          </header>
          {children}
        </article>
      </div>
    </div>
  );
}
