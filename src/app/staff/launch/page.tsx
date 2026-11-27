import Link from "next/link";
import { and, count, desc, eq, gte, like, lt, ne, notLike, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getOffice, currentTemplate, SERVICES } from "@/lib/settings";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { nowMs } from "@/lib/finance";
import { dateTime } from "@/lib/format";
import { storageMode, storageSelfTest } from "@/lib/storage";
import { STALE_AFTER_DAYS } from "@/lib/visa-match";

export const metadata = { title: "Launch checks" };

type Check = { area: string; name: string; state: "pass" | "warn" | "fail"; detail: string; fix?: string; href?: string };

const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

export default async function LaunchChecks() {
  await requireUser(["ADMIN"], "/staff/launch");
  const env = process.env;
  const stale = new Date(nowMs() - STALE_AFTER_DAYS * 86_400_000);
  const [realAdmins, demoActive, jobs, programs, visaCurrent, visaOverdue, contacts, lastEmail, storageError] = await Promise.all([
    n(db.select({ n: count() }).from(s.users).where(and(eq(s.users.role, "ADMIN"), eq(s.users.active, true), notLike(s.users.email, "%@firstflight.test"), eq(s.users.mustChangePassword, false)))),
    n(db.select({ n: count() }).from(s.users).where(and(eq(s.users.active, true), like(s.users.email, "%@firstflight.test")))),
    n(db.select({ n: count() }).from(s.jobs).where(eq(s.jobs.status, "PUBLISHED"))),
    n(db.select({ n: count() }).from(s.programs).where(eq(s.programs.status, "PUBLISHED"))),
    n(db.select({ n: count() }).from(s.visaGuidance).where(and(eq(s.visaGuidance.status, "PUBLISHED"), eq(s.visaGuidance.reviewState, "CURRENT"), gte(s.visaGuidance.lastCheckedAt, stale)))),
    n(db.select({ n: count() }).from(s.visaGuidance).where(and(eq(s.visaGuidance.status, "PUBLISHED"), or(ne(s.visaGuidance.reviewState, "CURRENT"), lt(s.visaGuidance.lastCheckedAt, stale))))),
    n(db.select({ n: count() }).from(s.whatsappContacts).where(eq(s.whatsappContacts.active, true))),
    db.select().from(s.emailLog).orderBy(desc(s.emailLog.createdAt)).limit(1).then((r) => r[0]),
    storageSelfTest(),
  ]);
  const office = await getOffice();
  const templates = await Promise.all(SERVICES.map((sv) => currentTemplate(sv)));
  const sample = templates.filter((t) => t.body.includes("[SAMPLE TEXT"));
  const url = siteUrl();
  const upload = env.UPLOAD_DIR || "./storage/uploads";
  const emailOn = !!(env.RESEND_API_KEY && env.EMAIL_FROM);

  const checks: Check[] = [
    { area: "Accounts", name: "A real administrator account", state: realAdmins ? "pass" : "fail", detail: realAdmins ? `${realAdmins} administrator account(s) with a real email address and a personal password.` : "Only the demo administrator exists.", fix: "Add FIRST FLIGHT's administrator under Users. After they choose their password, sign in as them.", href: "/staff/users" },
    { area: "Accounts", name: "Demo accounts switched off", state: demoActive ? "fail" : "pass", detail: demoActive ? `${demoActive} @firstflight.test demo account(s) can still sign in, all with the shared demo password.` : "No demo account can sign in.", fix: "Deactivate every account ending in @firstflight.test under Users.", href: "/staff/users?role=CLIENT" },
    { area: "Setup", name: "Sample-data notice removed", state: env.NEXT_PUBLIC_SAMPLE_DATA === "true" ? "fail" : "pass", detail: env.NEXT_PUBLIC_SAMPLE_DATA === "true" ? "The website footer says the content is sample data." : "No sample-data notice.", fix: "On Render, delete NEXT_PUBLIC_SAMPLE_DATA, then redeploy." },
    { area: "Setup", name: "Automatic sample data off", state: env.SEED_ON_EMPTY === "true" ? "warn" : "pass", detail: env.SEED_ON_EMPTY === "true" ? "If the database were ever empty, a deploy would fill it with sample data and demo accounts." : "Deploys never add sample data.", fix: "On Render, delete SEED_ON_EMPTY and SEED_PASSWORD." },
    { area: "Setup", name: "Secure public address", state: url.startsWith("https://") ? "pass" : "fail", detail: url, fix: "Set APP_URL to the site's https:// address (for example your own domain once it is connected)." },
    { area: "Email", name: "Email notifications connected", state: emailOn ? (lastEmail?.status === "FAILED" ? "fail" : "pass") : "warn", detail: !emailOn ? "Not connected: people only see notifications inside the system." : lastEmail ? `Last email ${lastEmail.status === "SENT" ? "sent" : lastEmail.status.toLowerCase()} ${dateTime(lastEmail.createdAt)}${lastEmail.error ? `: ${lastEmail.error}` : ""}.` : "Connected; nothing sent yet.", fix: "Create a Resend account, verify your domain, then add RESEND_API_KEY and EMAIL_FROM on Render." },
    {
      area: "Documents", name: "Permanent document storage",
      state: storageError ? "fail" : storageMode() === "object" || upload.startsWith("/var/data") ? "pass" : "fail",
      detail: storageError ? `Storage test failed: ${storageError}` : storageMode() === "object" ? `Object storage (bucket ${env.S3_BUCKET}); test write and read succeeded.` : upload.startsWith("/var/data") ? `Persistent disk at ${upload}; test write and read succeeded.` : `Files are kept in ${upload} on the server itself and are lost whenever the service restarts or redeploys.`,
      fix: "Either add a Render persistent disk at /var/data and set UPLOAD_DIR=/var/data/uploads (paid plan), or connect Cloudflare R2 / S3 with S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    },
    { area: "Setup", name: "Office address and map link confirmed", state: office.confirmed ? "pass" : "fail", detail: office.confirmed ? `${office.address} · ${office.mapsUrl}` : "Appointment invitations use a placeholder address until an administrator saves the real one.", fix: "Enter FIRST FLIGHT's office address and its Google Maps link in Settings.", href: "/staff/settings?tab=office" },
    { area: "Setup", name: "Contract wording replaced", state: sample.length ? "fail" : "pass", detail: sample.length ? `Clients would sign sample wording for: ${sample.map((t) => t.service).join(", ")}.` : "Every service has its own contract text.", fix: "Paste FIRST FLIGHT's lawyer-approved contract for each service in Settings → Contracts.", href: "/staff/settings?tab=contracts" },
    { area: "Content", name: "Published job offers", state: jobs ? "pass" : "warn", detail: `${jobs} published.`, fix: "Add FIRST FLIGHT's real job offers under Content.", href: "/staff/content/jobs" },
    { area: "Content", name: "Published study programs", state: programs ? "pass" : "warn", detail: `${programs} published.`, fix: "Add the real universities and programs under Content.", href: "/staff/content/programs" },
    { area: "Content", name: "Visa guidance checked", state: visaOverdue ? "warn" : visaCurrent ? "pass" : "warn", detail: `${visaCurrent} current; ${visaOverdue} flagged or not checked for ${STALE_AFTER_DAYS} days (visitors get a consultation offer for those).`, fix: "Check the entries in the review queue against their official sources.", href: "/staff/content/visa-review" },
    { area: "Content", name: "WhatsApp contacts", state: contacts ? "pass" : "warn", detail: `${contacts} shown on the website.`, fix: "Add at least one WhatsApp contact.", href: "/staff/content/whatsapp" },
    { area: "Content", name: "Sample listings replaced", state: "warn", detail: "The listings, universities, visa entries and news that came with the demo are examples. Replace or archive each one with FIRST FLIGHT's real information before launch.", href: "/staff/content" },
  ];
  const fails = checks.filter((c) => c.state === "fail").length, warns = checks.filter((c) => c.state === "warn").length;
  const STYLE = { pass: ["Ready", "bg-emerald-50 text-emerald-700"], warn: ["Check", "bg-amber-50 text-amber-800"], fail: ["Not ready", "bg-red-50 text-red-700"] } as const;
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">Launch checks</h1><p className="mt-1 max-w-2xl muted">Work through this list before giving the site to real clients. It re-checks every time you open it.</p></div>
      <p role="status" className={`rounded-2xl p-4 font-semibold ${fails ? "bg-red-50 text-red-800" : warns ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
        {fails ? `${fails} item${fails === 1 ? "" : "s"} must be fixed before launch${warns ? `, and ${warns} to review` : ""}.` : warns ? `Nothing blocking. ${warns} item${warns === 1 ? "" : "s"} to review.` : "Everything is ready for launch."}
      </p>
      <ul className="grid gap-3">
        {checks.map((c) => (
          <li key={c.name} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-xs font-bold uppercase tracking-wide muted">{c.area}</p><p className="font-semibold">{c.name}</p></div>
              <span className={`badge ${STYLE[c.state][1]}`}>{STYLE[c.state][0]}</span>
            </div>
            <p className="mt-2 text-sm">{c.detail}</p>
            {c.state !== "pass" && c.fix && <p className="mt-1 text-sm muted">{c.fix}{c.href && <> <Link href={c.href} className="font-semibold text-brand underline">Open</Link></>}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
