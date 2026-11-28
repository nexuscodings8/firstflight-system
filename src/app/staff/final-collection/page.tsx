import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { loadApplication } from "@/lib/applications";
import { canWorkOnCase } from "@/lib/permissions";
import { SERVICE_LABEL } from "@/lib/format";
import { Empty } from "@/components/cards";
import { FinalPanel } from "@/components/final-panel";
import { SectionNotices } from "@/components/section-notices";

export const metadata = { title: "Final collection – Document upload" };

export default async function FinalCollection({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireUser(["CONSULTANT", "ADMIN"], "/staff/final-collection");
  const all = (await searchParams).show === "all";
  const where: SQL[] = [eq(s.applications.stage, "FINAL_COLLECTION"), eq(s.applications.status, "ACTIVE")];
  if (user.role === "CONSULTANT") where.push(eq(s.applications.consultantId, user.id));
  if (!all) where.push(eq(s.applications.finalCollectionMode, "REMOTE"));
  const ids = await db.select({ id: s.applications.id }).from(s.applications).where(and(...where)).orderBy(desc(s.applications.finalCollectionChosenAt)).limit(40);
  const apps = (await Promise.all(ids.map((x) => loadApplication(x.id)))).filter((a): a is NonNullable<typeof a> => !!a && canWorkOnCase(user, a));
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(26px,3vw,36px)]">Final collection – Document upload</h1>
          <p className="mt-1 max-w-3xl text-sm muted">Clients at Final collection who chose to continue remotely{user.role === "CONSULTANT" ? " (your clients)" : ""}. Upload their scanned documents and completed forms; they&apos;re notified and can preview and download them. Replacing a document keeps the earlier versions.</p>
        </div>
        <nav aria-label="Filter" className="flex gap-1 text-sm">{[["", "Continuing remotely"], ["all", "Everyone at Final collection"]].map(([k, l]) => <Link key={k} href={`/staff/final-collection${k ? `?show=${k}` : ""}`} aria-current={(k === "all") === all ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${(k === "all") === all ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{l}</Link>)}</nav>
      </div>
      <SectionNotices user={user} sections={["final"]} path="/staff/final-collection" limit={6} />
      {apps.map((a) => (
        <div key={a.id} id={`app-${a.id}`} className="grid gap-2" data-testid="final-client">
          <p className="text-sm"><Link className="font-semibold text-brand underline" href={`/staff/applications/${a.id}`}>{a.client.name} · {a.reference}</Link> <span className="muted">· {SERVICE_LABEL[a.service]} · {(a.selection as { title: string }).title}</span></p>
          <FinalPanel app={a} mode="staff" canWork />
        </div>
      ))}
      {!apps.length && <Empty title={all ? "No clients at Final collection" : "No clients have chosen to continue remotely"} />}
    </div>
  );
}
