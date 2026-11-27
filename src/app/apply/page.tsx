import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveSelection, SELECTION_KEYS } from "@/lib/selection";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Checklist } from "@/components/checklist";
import { ApplyForm } from "@/components/apply-form";
import { SERVICE_LABEL } from "@/lib/format";
import { activeApplication } from "@/lib/create-application";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const keep = Object.fromEntries(SELECTION_KEYS.filter((k) => q[k]).map((k) => [k, q[k]!]));
  const here = `/apply?${new URLSearchParams(keep)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (user.role !== "CLIENT") redirect("/forbidden");
  const sel = await resolveSelection(q);
  if (!sel) notFound();
  const open = await activeApplication(user.id);
  return (
    <div className="wrap max-w-5xl">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: sel.service === "WORK" ? "/work" : sel.service === "STUDY" ? "/study" : "/visa", label: SERVICE_LABEL[sel.service] }, { label: "Apply" }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="card p-6">
          <p className="eyebrow">{SERVICE_LABEL[sel.service]}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl">{sel.title}</h1>
          <dl className="mt-4 grid gap-2">{sel.details.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line pb-2 text-sm"><dt className="muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}</dl>
          <h2 className="mt-6 text-lg">Documents you will upload</h2>
          <Checklist items={sel.checklist} />
          <p className="mt-3 text-sm muted">You can upload these in your portal after you submit. Your consultant may ask for more.</p>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Submit your application</h2>
          <p className="mt-1 text-sm muted">Applying as <strong>{user.name}</strong> ({user.email}).</p>
          <div className="mt-5">{open ? (
            <div role="status" className="rounded-xl border border-gold bg-gold/15 p-4">
              <p className="font-semibold">You already have an application in progress ({open.reference}).</p>
              <p className="mt-1 text-sm">You can have one active application at a time. You can apply again once it is completed or closed.</p>
              <Link href={`/portal/applications/${open.id}`} className="btn-primary btn-sm mt-3">Open my application</Link>
            </div>
          ) : sel.open ? <ApplyForm hidden={keep} /> : <p className="rounded-xl bg-mist p-4">This listing is not accepting applications right now. <Link className="text-brand underline" href="/contact">Speak to a consultant</Link>.</p>}</div>
        </section>
      </div>
    </div>
  );
}
