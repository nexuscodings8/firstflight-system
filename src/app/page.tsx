import Link from "next/link";
import { homeContent } from "@/lib/queries";
import { JobCard, ProgramCard } from "@/components/cards";
import { Icon } from "@/components/icons";
import { COMPANY } from "@/lib/company";
import { date, SERVICE_LABEL } from "@/lib/format";

const SERVICES = [
  { href: "/work", icon: "briefcase", title: "Find Jobs Abroad", text: "Browse destinations and job offers with salary, benefits and the documents you need.", cta: "Find jobs" },
  { href: "/study", icon: "cap", title: "Explore Study Programs", text: "Choose a continent, country and university, then compare programs, intakes and tuition.", cta: "Explore programs" },
  { href: "/visa", icon: "passport", title: "Check Visa Requirements", text: "Answer five questions to get a document checklist with the official source.", cta: "Check requirements" },
];

export default async function Home() {
  const c = await homeContent();
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,var(--color-brand),#2f72d8)] text-white">
        <div aria-hidden="true" className="absolute -right-24 -top-24 hidden size-96 rounded-full bg-gold/90 md:block" />
        <div aria-hidden="true" className="absolute -right-10 top-36 hidden h-3 w-[38rem] -rotate-12 rounded-full bg-white/25 md:block" />
        <div className="wrap relative py-14 sm:py-20">
          <p className="font-semibold text-gold">Work abroad · Study abroad · Visa processing</p>
          <h1 className="mt-3 max-w-3xl text-4xl text-white sm:text-5xl lg:text-6xl">Your next step abroad starts here</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90">Find a job, a study program or the visa you need. Apply online and follow every step with a FIRST FLIGHT consultant.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {SERVICES.map((s) => (
              <Link key={s.href} href={s.href} className="group rounded-2xl bg-white p-6 text-ink shadow-xl ring-1 ring-black/5 transition hover:-translate-y-1 motion-reduce:transition-none">
                <span className="grid size-12 place-items-center rounded-xl bg-gold/25 text-brand"><Icon name={s.icon} className="size-6" /></span>
                <h2 className="mt-4 text-2xl">{s.title}</h2>
                <p className="mt-2 muted">{s.text}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand">{s.cta} <Icon name="arrow" className="size-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {c.promos.length > 0 && (
        <section aria-labelledby="promos" className="wrap mt-12">
          <h2 id="promos" className="text-2xl sm:text-3xl">Current promotions</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {c.promos.map((p) => (
              <div key={p.id} className="flex flex-col justify-between gap-4 rounded-2xl bg-gold p-6 sm:flex-row sm:items-center">
                <div><h3 className="text-xl">{p.title}</h3><p className="mt-1 text-ink/85">{p.body}</p><p className="mt-2 text-sm font-semibold">Until {date(p.expiresAt)}</p></div>
                <Link href={p.ctaUrl} className="btn-primary shrink-0">{p.ctaLabel}</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="featured" className="wrap mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="featured" className="text-2xl sm:text-3xl">Featured opportunities</h2>
          <div className="flex gap-2"><Link href="/work/jobs" className="btn-ghost btn-sm">All jobs</Link><Link href="/study/search" className="btn-ghost btn-sm">All programs</Link></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.featuredJobs.map((r) => <JobCard key={r.job.id} r={r} />)}
          {c.featuredPrograms.map((r) => <ProgramCard key={r.program.id} r={r} />)}
        </div>
      </section>

      <section aria-labelledby="how" className="mt-14 bg-mist py-14">
        <div className="wrap">
          <h2 id="how" className="text-2xl sm:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {[["Browse", "Pick a job, program or visa and see exactly what you need."], ["Apply online", "Create an account, apply and upload your documents."], ["Work with a consultant", "Your consultant checks your file and asks for anything missing."], ["Track every step", "See your stage, invoices, payments and receipts in your portal."]].map(([t, d], i) => (
              <li key={t} className="card p-5"><span className="grid size-9 place-items-center rounded-full bg-brand font-display font-bold text-white">{i + 1}</span><h3 className="mt-3 text-lg">{t}</h3><p className="mt-1 text-sm muted">{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {c.portfolio.length > 0 && (
        <section aria-labelledby="portfolio" className="wrap mt-14">
          <h2 id="portfolio" className="text-2xl sm:text-3xl">Our portfolio</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">{c.portfolio.map((p) => <div key={p.id} className="card p-5"><h3 className="text-lg">{p.title}</h3>{p.year && <p className="text-sm font-semibold text-brand">{p.year}</p>}<p className="mt-2 text-sm muted">{p.summary}</p></div>)}</div>
          <Link href="/contact" className="btn-ghost mt-5">Speak to a consultant</Link>
        </section>
      )}

      {c.testimonials.length > 0 && (
        <section aria-labelledby="testimonials" className="wrap mt-14">
          <h2 id="testimonials" className="text-2xl sm:text-3xl">What our clients say</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">{c.testimonials.map((t) => <figure key={t.id} className="card p-5"><blockquote className="text-ink">“{t.quote}”</blockquote><figcaption className="mt-3 text-sm font-semibold">{t.clientName} <span className="font-normal muted">· {SERVICE_LABEL[t.service]}</span></figcaption></figure>)}</div>
        </section>
      )}

      {c.news.length > 0 && (
        <section aria-labelledby="news" className="wrap mt-14">
          <div className="flex items-end justify-between gap-3"><h2 id="news" className="text-2xl sm:text-3xl">News and updates</h2><Link href="/news" className="btn-ghost btn-sm">All news</Link></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">{c.news.map((n) => <Link key={n.id} href={`/news/${n.slug}`} className="card-link p-5"><p className="text-sm muted">{date(n.publishedAt)}</p><h3 className="mt-1 text-lg">{n.title}</h3><p className="mt-2 text-sm muted">{n.excerpt}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">Read more <Icon name="arrow" className="size-4" /></span></Link>)}</div>
        </section>
      )}

      <section aria-labelledby="contact" className="wrap mt-14">
        <div className="grid gap-6 rounded-3xl bg-navy p-8 text-white md:grid-cols-[1.3fr_1fr] md:p-10">
          <div>
            <h2 id="contact" className="text-2xl text-white sm:text-3xl">Talk to a FIRST FLIGHT consultant</h2>
            <p className="mt-2 text-white/85">Not sure where to start? Tell us your plans and we will guide you to the right job, program or visa.</p>
            <Link href="/contact" className="btn-gold mt-5">Speak to a consultant</Link>
          </div>
          <ul className="grid content-center gap-3">
            {COMPANY.phones.map((p) => <li key={p}><a href={`tel:${p.replace(/\s/g, "")}`} className="flex items-center gap-3 font-semibold hover:underline"><Icon name="phone" className="size-5 text-gold" />{p}</a></li>)}
            <li><a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 font-semibold hover:underline"><Icon name="mail" className="size-5 text-gold" />{COMPANY.email}</a></li>
          </ul>
        </div>
      </section>
    </>
  );
}
