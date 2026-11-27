import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SERVICES, currentTemplate, getOffice, getRefundPolicies } from "@/lib/settings";
import { SERVICE_LABEL, date } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { saveContractTemplate, saveOffice, saveRefundPolicy } from "./actions";

export const metadata = { title: "Settings" };
const PLACEHOLDERS = ["client_name", "client_email", "client_phone", "reference", "listing", "service", "fee", "installments", "date"];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser(["ADMIN", "FINANCE"], "/staff/settings");
  const tab = me.role === "FINANCE" ? "refunds" : ((await searchParams).tab ?? "office");
  const tabs = me.role === "ADMIN" ? [["office", "Office"], ["refunds", "Refund policies"], ["contracts", "Contracts"]] : [["refunds", "Refund policies"]];
  let body: React.ReactNode;
  if (tab === "refunds") {
    const pol = await getRefundPolicies();
    body = SERVICES.map((sv) => (
      <section key={sv} className="card p-5" aria-labelledby={`rp-${sv}`}>
        <h2 id={`rp-${sv}`} className="text-xl">{SERVICE_LABEL[sv]}</h2>
        <ActionForm action={saveRefundPolicy} submit="Save policy" resetOnSuccess={false} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="service" value={sv} />
          <div><label className="label" htmlFor={`a-${sv}`}>Refund requests open after (days from first approved payment)</label><input id={`a-${sv}`} name="eligibleAfterDays" type="number" min={0} max={730} defaultValue={pol[sv].eligibleAfterDays} className="input" /></div>
          <div><label className="label" htmlFor={`w-${sv}`}>…and stay open for (days; 0 = no end)</label><input id={`w-${sv}`} name="windowDays" type="number" min={0} max={1825} defaultValue={pol[sv].windowDays} className="input" /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="allowReapplication" defaultChecked={pol[sv].allowReapplication} className="size-4 accent-brand" /> Clients may ask to reapply instead of a refund</label>
          <div className="sm:col-span-2"><label className="label" htmlFor={`t-${sv}`}>Policy text shown to clients</label><textarea id={`t-${sv}`} name="terms" rows={3} defaultValue={pol[sv].terms} className="input" maxLength={1500} /></div>
        </ActionForm>
      </section>
    ));
  } else if (tab === "contracts") {
    const t = await Promise.all(SERVICES.map((sv) => currentTemplate(sv)));
    body = SERVICES.map((sv, i) => (
      <section key={sv} className="card p-5" aria-labelledby={`ct-${sv}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id={`ct-${sv}`} className="text-xl">{SERVICE_LABEL[sv]} contract</h2><p className="text-sm muted">Version {t[i].version} · {date(t[i].createdAt)}</p></div>
        {t[i].body.includes("[SAMPLE TEXT") && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This is sample wording. Replace it with FIRST FLIGHT&apos;s lawyer-approved contract before real clients sign.</p>}
        <ActionForm action={saveContractTemplate} submit="Save as new version" resetOnSuccess={false} className="mt-3 grid gap-3">
          <input type="hidden" name="service" value={sv} />
          <div><label className="label" htmlFor={`ttl-${sv}`}>Title</label><input id={`ttl-${sv}`} name="title" defaultValue={t[i].title} className="input" required maxLength={150} /></div>
          <div><label className="label" htmlFor={`bd-${sv}`}>Contract text</label><textarea id={`bd-${sv}`} name="body" rows={14} defaultValue={t[i].body} className="input font-mono text-sm" required /></div>
          <p className="text-xs muted">Filled in for each client: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}</p>
        </ActionForm>
      </section>
    ));
  } else {
    const o = await getOffice();
    body = (
      <section className="card p-5">
        <h2 className="text-xl">Office details</h2>
        <p className="mt-1 text-sm muted">Used in appointment invitations and contracts.{!o.confirmed && " These are placeholders: enter FIRST FLIGHT's real address and Google Maps link."}</p>
        <ActionForm action={saveOffice} submit="Save office details" resetOnSuccess={false} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="o-a">Address</label><input id="o-a" name="address" defaultValue={o.address} className="input" required /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="o-m">Google Maps link</label><input id="o-m" name="mapsUrl" type="url" defaultValue={o.mapsUrl} className="input" required /></div>
          <div><label className="label" htmlFor="o-p">Office phone</label><input id="o-p" name="phone" defaultValue={o.phone} className="input" /></div>
          <div><label className="label" htmlFor="o-h">Opening hours</label><input id="o-h" name="hours" defaultValue={o.hours} className="input" /></div>
        </ActionForm>
      </section>
    );
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-[clamp(26px,3vw,36px)]">Settings</h1>
      <nav aria-label="Settings sections" className="flex flex-wrap gap-1 text-sm">{tabs.map(([k, t]) => <Link key={k} href={`/staff/settings?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === k ? "bg-brand text-white" : "bg-white hover:bg-mist"}`}>{t}</Link>)}</nav>
      {body}
    </div>
  );
}
