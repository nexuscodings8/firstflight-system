"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "../icons";

export type NavItem = { href: string; label: string; icon: string; count?: number };

/** The best-matching item is active: same path (and query, if the item has one), else the longest path prefix. */
function activeHref(items: NavItem[], path: string, query: URLSearchParams) {
  let best: { href: string; score: number } | null = null;
  for (const it of items) {
    const [p, q] = it.href.split("?");
    const params = new URLSearchParams(q ?? "");
    const queryOk = [...params].every(([k, v]) => query.get(k) === v);
    if (!queryOk) continue;
    let score = -1;
    if (path === p) score = 1000 + p.length + [...params].length * 10;
    else if (p !== "/portal" && p !== "/staff" && path.startsWith(p + "/")) score = p.length;
    if (score > (best?.score ?? -1)) best = { href: it.href, score };
  }
  return best?.href;
}

export function SideNav({ items, name, roleLabel }: { items: NavItem[]; name: string; roleLabel: string }) {
  const path = usePathname();
  const query = useSearchParams();
  const active = activeHref(items, path, query);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return (
    <nav aria-label="Sections" className="no-print bg-[#0d2a66] text-white lg:min-h-[calc(100vh-80px)] lg:px-3 lg:py-4">
      <div className="hidden items-center gap-2.5 border-b border-white/15 px-2 pb-4 lg:flex">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-gold font-display text-[15px] font-extrabold text-ink">{initials}</span>
        <span className="min-w-0 leading-tight"><span className="block truncate font-semibold">{name}</span><span className="text-sm text-white/65">{roleLabel}</span></span>
      </div>
      <ul className="flex gap-1 overflow-x-auto px-2 py-2 lg:mt-3 lg:flex-col lg:overflow-visible lg:p-0">
        {items.map((it) => {
          const on = it.href === active;
          return (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={on ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 whitespace-nowrap rounded-[10px] px-3 py-2 text-[15px] transition-colors lg:whitespace-normal ${on ? "bg-white/15 font-bold text-white lg:before:absolute lg:before:-left-3 lg:before:top-2.5 lg:before:bottom-2.5 lg:before:w-1 lg:before:rounded-r lg:before:bg-gold max-lg:bg-gold max-lg:text-ink" : "font-medium text-white/80 hover:bg-white/10 hover:text-white"}`}>
                <span className={on ? "lg:text-gold" : "opacity-80"}><Icon name={it.icon} className="size-5" /></span>
                <span className="flex-1">{it.label}</span>
                {!!it.count && <span className="rounded-full bg-gold px-2 py-px text-xs font-bold text-ink">{it.count}<span className="sr-only"> waiting</span></span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
