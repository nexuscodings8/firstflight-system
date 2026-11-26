import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ENTITIES, type Group } from "@/lib/content/entities";

const GROUPS: Group[] = ["Catalogue", "Visa", "Website"];

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["CONTENT_MANAGER", "ADMIN"], "/staff/content");
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Content" className="no-print h-fit rounded-2xl border border-line bg-white p-3 text-sm lg:sticky lg:top-24">
        <Link href="/staff/content" className="block rounded-lg px-3 py-2 font-semibold hover:bg-mist">Overview</Link>
        {GROUPS.map((g) => (
          <div key={g} className="mt-2">
            <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wide muted">{g}</p>
            {Object.values(ENTITIES).filter((e) => e.group === g).map((e) => <Link key={e.key} href={`/staff/content/${e.key}`} className="block rounded-lg px-3 py-1.5 font-medium hover:bg-mist">{e.plural}</Link>)}
            {g === "Visa" && <Link href="/staff/content/visa-review" className="block rounded-lg px-3 py-1.5 font-medium hover:bg-mist">Review queue</Link>}
          </div>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
