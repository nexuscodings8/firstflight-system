import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { MobileMenu } from "./mobile-menu";

export const NAV = [
  { href: "/work", label: "Work Abroad" },
  { href: "/study", label: "Study Abroad" },
  { href: "/visa", label: "Visa Processing" },
  { href: "/flights", label: "Flights" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const account = user ? { href: homeFor(user.role), label: user.role === "CLIENT" ? "My portal" : "Staff dashboard" } : { href: "/login", label: "Sign in" };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="h-1 bg-[linear-gradient(90deg,var(--color-brand)_0_72%,var(--color-gold)_72%)]" />
      <div className="wrap flex h-[76px] items-center gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="FIRST FLIGHT home">
          <Image src="/logo-mark.png" alt="" width={48} height={48} className="size-12 rounded-xl ring-1 ring-line" priority />
          <span className="leading-tight">
            <span className="block font-display text-xl font-extrabold tracking-wide text-brand">FIRST FLIGHT</span>
            <span className="block text-[11px] font-semibold tracking-[.16em] text-muted uppercase">Best Travel Solution Ltd</span>
          </span>
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 whitespace-nowrap xl:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink hover:bg-mist hover:text-brand">{n.label}</Link>
          ))}
          <Link href={account.href} className="btn-primary btn-sm ml-2">{account.label}</Link>
          {!user && <Link href="/register" className="btn-gold btn-sm">Create account</Link>}
        </nav>
        <MobileMenu items={NAV} account={account} showRegister={!user} />
      </div>
    </header>
  );
}
