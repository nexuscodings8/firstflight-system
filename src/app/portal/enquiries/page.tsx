import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { Empty } from "@/components/cards";
import { dateTime, label } from "@/lib/format";

export const metadata = { title: "My enquiries" };

export default async function MyEnquiries() {
  const user = await requireUser(["CLIENT"], "/portal/enquiries");
  const rows = await db.select().from(s.enquiries).where(eq(s.enquiries.clientId, user.id)).orderBy(desc(s.enquiries.createdAt));
  return (
    <div>
      <h1 className="text-[clamp(26px,3vw,36px)]">My enquiries</h1>
      <div className="mt-5 grid gap-3">
        {rows.map((e) => (
          <div key={e.id} className="card p-5">
            <div className="flex flex-wrap justify-between gap-2"><p className="eyebrow">{e.reference} · {label(e.type)}</p><span className="badge bg-mist text-brand">{label(e.status)}</span></div>
            <p className="mt-2 whitespace-pre-line">{e.message}</p><p className="mt-1 text-xs muted">{dateTime(e.createdAt)}</p>{e.resolution && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm"><span className="font-semibold">Our answer:</span> {e.resolution}</p>}
          </div>
        ))}
      </div>
      {!rows.length && <Empty title="No enquiries yet" />}
    </div>
  );
}
