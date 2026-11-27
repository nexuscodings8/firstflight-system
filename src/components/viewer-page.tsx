import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadViewable } from "@/lib/viewer";
import { FileViewer } from "./file-viewer";
import { ReviewControls } from "./case-tools";

export async function ViewerPage({ params, area }: { params: Promise<{ kind: string; id: string }>; area: "staff" | "portal" }) {
  const { kind, id } = await params;
  const user = await requireUser(area === "portal" ? ["CLIENT"] : ["ADMIN", "CONSULTANT", "FINANCE"], `/${area}/viewer/${kind}/${id}`);
  const v = await loadViewable(user, kind, id);
  if (!v) notFound();
  return (
    <>
      <Link href={v.back.href} className="mb-4 inline-flex text-sm font-semibold text-brand underline">← {v.back.label}</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <FileViewer src={v.src} download={v.download} mime={v.mime} fileName={v.fileName} />
        <aside className="space-y-4">
          <div className="card p-5">
            <h1 className="text-lg">{v.title}</h1>
            <dl className="mt-3 space-y-2 text-sm">{v.meta.map(([k, val]) => <div key={k}><dt className="muted">{k}</dt><dd className="font-semibold">{val}</dd></div>)}</dl>
          </div>
          {v.review && <div className="card p-5"><h2 className="text-base">Review this document</h2><ReviewControls {...v.review} /></div>}
        </aside>
      </div>
    </>
  );
}
