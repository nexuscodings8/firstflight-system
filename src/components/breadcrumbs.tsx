import Link from "next/link";
import { Icon } from "./icons";

export type Crumb = { href?: string; label: string };

/** Breadcrumbs plus a visible back link to the previous level. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const back = [...items].reverse().find((c, i) => i > 0 && c.href);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 text-sm">
      {back && (
        <Link href={back.href!} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-brand hover:border-brand">
          <Icon name="back" className="size-4" /> Back
        </Link>
      )}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">›</span>}
              {c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-brand hover:underline">{c.label}</Link> : <span aria-current="page" className="font-semibold text-ink">{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
