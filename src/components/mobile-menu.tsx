"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function MobileMenu({ items, account, showRegister }: { items: { href: string; label: string }[]; account: { href: string; label: string }; showRegister: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="ml-auto xl:hidden">
      <button type="button" className="btn-ghost btn-sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? "close" : "menu"} /> Menu
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="absolute inset-x-0 top-full border-b border-line bg-white shadow-lg">
          <ul className="wrap grid gap-1 py-3">
            {items.map((n) => (
              <li key={n.href}><Link href={n.href} className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-mist">{n.label}</Link></li>
            ))}
            <li className="mt-2 grid grid-cols-2 gap-2">
              <Link href={account.href} className="btn-primary">{account.label}</Link>
              {showRegister && <Link href="/register" className="btn-gold">Create account</Link>}
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
