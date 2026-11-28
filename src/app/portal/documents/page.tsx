import { SectionNotices } from "@/components/section-notices";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { clientApps } from "@/lib/client-data";
import { dateTime } from "@/lib/format";
import { UploadForm } from "@/components/upload-form";
import { Icon } from "@/components/icons";
import { Empty } from "@/components/cards";

export const metadata = { title: "Document center" };
const STATE: Record<string, [string, string]> = {
  PENDING: ["To upload", "bg-slate-100 text-slate-700"], REQUESTED: ["Requested by consultant", "bg-amber-50 text-amber-800"],
  UPLOADED: ["Uploaded, awaiting check", "bg-blue-50 text-brand"], VERIFIED: ["Verified", "bg-emerald-50 text-emerald-700"], REJECTED: ["Please re-upload", "bg-red-50 text-red-700"],
};

export default async function Documents() {
  const user = await requireUser(["CLIENT"], "/portal/documents");
  const apps = (await clientApps(user.id)).filter((a) => a.checklist.length);
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Document center</h1><p className="mt-1 muted">Every document for every application. PDF, JPG, PNG or Word, up to 10 MB each.</p></div>
      <SectionNotices user={user} sections={["offer", "final", "documents", "visa"]} path="/portal/documents" limit={5} />
      {apps.map((a) => (
        <section key={a.id} className="card p-5" aria-labelledby={`dc-${a.id}`}>
          <h2 id={`dc-${a.id}`} className="text-lg"><Link className="text-brand underline" href={`/portal/applications/${a.id}`}>{a.reference}</Link> · {(a.selection as { title: string }).title}</h2>
          <ul className="mt-2 divide-y divide-line">
            {a.checklist.map((c) => (
              <li key={c.id} className="py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{c.label}{!c.mandatory && <span className="ml-2 text-xs font-normal muted">Optional</span>}</span><span className={`badge ${STATE[c.state][1]}`}>{STATE[c.state][0]}</span></div>
                {c.note && <p className="mt-1 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{c.note}</p>}
                {c.documents.length > 0 && <ul className="mt-1.5 space-y-1 text-sm">{c.documents.map((d) => <li key={d.id}><a className="inline-flex items-center gap-1.5 text-brand underline" href={`/api/documents/${d.id}`}><Icon name="file" className="size-4" />{d.fileName}</a> <span className="muted">· {dateTime(d.createdAt)}</span></li>)}</ul>}
                {a.status === "ACTIVE" && c.state !== "VERIFIED" && <UploadForm applicationId={a.id} itemId={c.id} label={c.label} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!apps.length && <Empty title="No documents needed yet" />}
    </div>
  );
}
