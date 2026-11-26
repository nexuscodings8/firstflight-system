import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { Icon } from "../icons";
import { SideNav, type NavItem } from "./side-nav";

/** Layout shared by the client portal and the staff dashboard: top bar, navy sidebar (tabs on phones), content. */
export function AppShell({ subtitle, roleLabel, name, home, items, children }: { subtitle: string; roleLabel: string; name: string; home: string; items: NavItem[]; children: React.ReactNode }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return (
    <div className="min-h-screen bg-mist print:bg-white">
      <header className="no-print relative z-30 border-b border-line bg-white shadow-[0_2px_14px_rgba(4,66,159,.07)] after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-[linear-gradient(90deg,var(--color-brand)_0_72%,var(--color-gold)_72%)]">
        <div className="flex min-h-20 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-[max(2rem,3vw)]">
          <Link href={home} className="flex items-center gap-3" aria-label={`FIRST FLIGHT ${subtitle}`}>
            <Image src="/logo-mark.png" alt="" width={48} height={48} className="size-12 rounded-xl ring-1 ring-line" priority />
            <span className="leading-tight"><span className="block font-display text-xl font-extrabold tracking-wide text-brand">FIRST FLIGHT</span><span className="block text-[11px] font-semibold uppercase tracking-[.16em] text-muted">{subtitle}</span></span>
          </Link>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden rounded-full bg-brand/10 px-3 py-1 text-[13px] font-bold text-brand sm:inline">{roleLabel}</span>
            <span aria-hidden="true" className="hidden size-10 place-items-center rounded-full bg-gold font-display text-[15px] font-extrabold text-ink sm:grid">{initials}</span>
            <Link href="/" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-brand hover:bg-mist md:inline">Website</Link>
            <form action={logout}><button className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 font-medium text-ink hover:border-brand hover:text-brand"><Icon name="out" className="size-5" /><span>Sign out</span></button></form>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <Suspense fallback={<div className="bg-[#0d2a66] lg:min-h-screen" />}><SideNav items={items} name={name} roleLabel={roleLabel} /></Suspense>
        <div id="content" className="min-w-0 px-4 pb-14 pt-6 sm:px-[max(2rem,3vw)]">{children}</div>
      </div>
    </div>
  );
}

/** Dashboard number card with a tinted icon, as in the FIRST FLIGHT demo. */
export function Kpi({ label, value, icon, tone = 0, href }: { label: string; value: React.ReactNode; icon: string; tone?: number; href?: string }) {
  const tones = ["bg-brand/10 text-brand", "bg-gold/25 text-[#7a5600]", "bg-emerald-600/10 text-emerald-700", "bg-navy/10 text-navy"];
  const body = (
    <>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tones[tone % 4]}`}><Icon name={icon} className="size-[22px]" /></span>
      <span className="flex min-w-0 flex-col"><span className="text-sm muted">{label}</span><b className="font-display text-[clamp(20px,2.4vw,30px)] [overflow-wrap:anywhere] sm:whitespace-nowrap font-extrabold leading-tight text-ink">{value}</b></span>
    </>
  );
  const cls = "flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:gap-3.5 rounded-2xl border border-line bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(15,35,80,.05),0_6px_18px_rgba(15,35,80,.06)]";
  return href ? <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:border-brand`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export const KpiRow = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(14.5em,1fr))]">{children}</div>;
