import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { findActivation } from "@/lib/tokens";
import { ActivateForm } from "@/components/activate-form";

export const metadata = { title: "Activate your account", robots: { index: false } };

export default async function Activate({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const t = await findActivation(token);
  const u = t ? await db.query.users.findFirst({ where: eq(s.users.id, t.userId), columns: { name: true, email: true } }) : null;
  return (
    <div className="bg-mist py-10">
      <div className="wrap max-w-md">
        <div className="card p-6">
          <h1 className="font-display text-2xl font-bold">Activate your account</h1>
          {u ? <><p className="mt-1 mb-5 text-sm muted">Welcome, {u.name}. Choose a password for {u.email}.</p><ActivateForm token={token} /></>
            : <p className="mt-2">This link has expired or was already used. Ask your FIRST FLIGHT consultant to send a new one.</p>}
        </div>
      </div>
    </div>
  );
}
