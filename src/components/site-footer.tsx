import Link from "next/link";
import Image from "next/image";
import { COMPANY } from "@/lib/company";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-4 border-gold bg-navy text-white">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.png" alt="" width={48} height={48} className="size-12 rounded-xl bg-white" />
            <span className="font-display text-lg font-extrabold">FIRST FLIGHT</span>
          </div>
          <p className="mt-3 text-sm text-white/80">{COMPANY.legalName}. Work abroad, study abroad and visa processing, with one team and one tracked process.</p>
        </div>
        <div>
          <h2 className="font-display text-base text-gold">Services</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:underline" href="/work">Find jobs abroad</Link></li>
            <li><Link className="hover:underline" href="/study">Explore study programs</Link></li>
            <li><Link className="hover:underline" href="/visa">Check visa requirements</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-base text-gold">Call us</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {COMPANY.phones.map((p) => <li key={p}><a className="hover:underline" href={`tel:${p.replace(/\s/g, "")}`}>{p}</a></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-base text-gold">Email</h2>
          <p className="mt-3 text-sm"><a className="hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
          <p className="mt-4"><Link href="/contact" className="btn-gold btn-sm">Speak to a consultant</Link></p>
        </div>
      </div>
      {process.env.NEXT_PUBLIC_SAMPLE_DATA === "true" && (
        <p className="wrap pb-6 text-xs text-white/70">Test environment: listings, salaries, tuition and visa guidance shown here are sample data.</p>
      )}
    </footer>
  );
}
