import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ENTITIES, type Group } from "@/lib/content/entities";

const GROUPS: Group[] = ["Catalogue", "Visa", "Website"];

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["CONTENT_MANAGER", "ADMIN"], "/staff/content");
  return (
    <div className="grid gap-5">
      <nav aria-label="Content types" className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
        <Link href="/staff/content" className="font-semibold text-brand hover:underline">All content</Link>
        {GROUPS.map((g) => (
          <span key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide muted">{g}</span>
            {Object.values(ENTITIES).filter((e) => e.group === g).map((e) => <Link key={e.key} href={`/staff/content/${e.key}`} className="rounded-full bg-mist px-2.5 py-1 font-medium hover:bg-brand hover:text-white">{e.plural}</Link>)}
            {g === "Visa" && <Link href="/staff/content/visa-review" className="rounded-full bg-mist px-2.5 py-1 font-medium hover:bg-brand hover:text-white">Review queue</Link>}
          </span>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
