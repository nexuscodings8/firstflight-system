import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { COMPANY } from "../company";
import { listJobs, searchPrograms } from "../queries";
import { detectIntent, findCountry, findLevel, keywords } from "./intent";

export type Reply = { text: string; links?: { label: string; href: string }[]; suggestions?: string[]; handoff?: boolean };

const MENU = ["Find jobs abroad", "Study programs", "Visa requirements", "Book a flight", "Talk to a consultant"];

async function publishedCountries() {
  return db.select({ name: s.countries.name, iso: s.countries.isoCode, slug: s.countries.slug, work: s.countries.workDestination, study: s.countries.studyDestination })
    .from(s.countries).where(eq(s.countries.status, "PUBLISHED"));
}

/** One assistant turn. Answers only from published FIRST FLIGHT data and fixed explanations. */
export async function answer(message: string): Promise<Reply> {
  const intent = detectIntent(message);
  switch (intent) {
    case "greeting":
      return { text: "Hello! I'm the FIRST FLIGHT assistant. I can help you find jobs abroad, study programs and visa requirements, or put you in touch with a consultant. What are you looking for?", suggestions: MENU };
    case "flights":
      return { text: "We can find and book flights for you. Tell us your route, dates and travellers, and a consultant will send you options and prices. Nothing is booked until you confirm.", links: [{ label: "Request flight options", href: "/flights" }] };
    case "thanks":
      return { text: "You're welcome. Is there anything else I can help with?", suggestions: MENU };
    case "human":
      return { text: "Of course. Leave your name and how to reach you, and a FIRST FLIGHT consultant will reply. You can also message us on WhatsApp or call " + COMPANY.phones[0] + ".", handoff: true };
    case "fees":
      return { text: "Our service fees depend on the service and the destination, so a consultant confirms them for your case before you pay anything. Tuition and salaries are shown on each program and job page. Once you apply, invoices and receipts appear in your client portal.", suggestions: ["Talk to a consultant", "Study programs", "Find jobs abroad"] };
    case "track":
      return { text: "Sign in to your client portal to see each application's stage, the documents still needed, updates from your consultant, and your invoices and receipts.", links: [{ label: "Open my portal", href: "/portal" }, { label: "Create an account", href: "/register" }] };
    case "documents":
      return { text: "Every job, program and visa has its own document checklist. You'll see it on the listing, and after you apply you upload each document in your portal (PDF, JPG, PNG or Word, up to 10 MB). Your consultant checks each one and tells you if something needs replacing.", suggestions: ["Find jobs abroad", "Study programs", "Visa requirements"] };
    case "apply":
      return { text: "Choose a job or program, press Apply, and create a free account if you don't have one. Your application gets a reference number, a consultant is assigned, and you follow every step in your portal.", links: [{ label: "Find jobs abroad", href: "/work" }, { label: "Explore study programs", href: "/study" }, { label: "Create an account", href: "/register" }] };
    case "contact":
      return { text: `You can reach FIRST FLIGHT on ${COMPANY.phones.join(", ")} or by email at ${COMPANY.email}. Tap the WhatsApp button to message the right desk directly.`, links: [{ label: "Contact page", href: "/contact" }] };
    case "jobs": {
      const countries = await publishedCountries();
      const c = findCountry(message, countries.map((x) => ({ ...x, name: x.name, iso: x.iso })));
      const words = keywords(message, c?.name);
      let rows = await listJobs({ country: c?.work ? c.slug : undefined, availability: "open", q: words[0] });
      const matched = rows.length > 0 && !!words[0];
      if (!rows.length && words.length) rows = await listJobs({ country: c?.work ? c.slug : undefined, availability: "open" });
      if (c && !c.work) return { text: `We don't currently list jobs in ${c.name}. Here are the countries we recruit for.`, links: countries.filter((x) => x.work).map((x) => ({ label: `Jobs in ${x.name}`, href: `/work/${x.slug}` })).slice(0, 6), suggestions: ["Talk to a consultant"] };
      if (!rows.length) return { text: "There are no open jobs matching that right now. New offers are added regularly; a consultant can tell you what's coming.", links: [{ label: "See all jobs", href: "/work/jobs" }], suggestions: ["Talk to a consultant"] };
      const top = rows.slice(0, 4);
      const where = c?.work ? ` in ${c.name}` : "";
      const intro = matched
        ? `I found ${rows.length} open "${words[0]}" job${rows.length === 1 ? "" : "s"}${where}.`
        : words[0]
          ? `I couldn't find open "${words[0]}" jobs${where} right now, but there ${rows.length === 1 ? "is 1 other open job" : `are ${rows.length} other open jobs`}${where}.`
          : `There ${rows.length === 1 ? "is 1 open job" : `are ${rows.length} open jobs`}${where}.`;
      return {
        text: intro,
        links: [...top.map((r) => ({ label: `${r.job.title}, ${r.job.location} (${r.country.name})`, href: `/work/${r.country.slug}/${r.job.slug}` })), { label: "See all matching jobs", href: c?.work ? `/work/${c.slug}` : "/work/jobs" }],
      };
    }
    case "study": {
      const countries = await publishedCountries();
      const c = findCountry(message, countries);
      const level = findLevel(message);
      const words = keywords(message, c?.name).filter((w) => !/^(bachelors?|masters?|phd|diploma|foundation|msc|mba|bsc)$/.test(w));
      let rows = await searchPrograms({ country: c?.study ? c.slug : undefined, level, q: words[0] });
      const matched = rows.length > 0 && !!words[0];
      if (!rows.length && words.length) rows = await searchPrograms({ country: c?.study ? c.slug : undefined, level });
      if (c && !c.study) return { text: `We don't currently list programs in ${c.name}. A consultant can still advise you.`, links: [{ label: "Explore study destinations", href: "/study" }], suggestions: ["Talk to a consultant"] };
      if (!rows.length) return { text: "I couldn't find a published program matching that. A consultant can look at options with you.", links: [{ label: "Search all programs", href: "/study/search" }], suggestions: ["Talk to a consultant"] };
      const top = rows.slice(0, 4);
      const q = new URLSearchParams({ ...(c?.study ? { country: c.slug } : {}), ...(level ? { level } : {}) }).toString();
      const what = `${level ? `${level.toLowerCase()} level ` : ""}program${rows.length === 1 ? "" : "s"}${c?.study ? ` in ${c.name}` : ""}`;
      return {
        text: matched ? `I found ${rows.length} "${words[0]}" ${what}.` : words[0] ? `I couldn't find "${words[0]}" programs, but there ${rows.length === 1 ? "is 1" : `are ${rows.length}`} ${what}.` : `There ${rows.length === 1 ? "is 1" : `are ${rows.length}`} ${what}.`,
        links: [...top.map((r) => ({ label: `${r.program.name}, ${r.uni.name}`, href: `/study/${r.continent.slug}/${r.country.slug}/${r.uni.slug}/${r.program.slug}` })), { label: "See all matching programs", href: `/study/search${q ? `?${q}` : ""}` }],
      };
    }
    case "visa": {
      const all = await db.select({ name: s.countries.name, iso: s.countries.isoCode }).from(s.countries).where(eq(s.countries.status, "PUBLISHED"));
      const { listCountries } = await import("../locations");
      const c = findCountry(message, all) ?? findCountry(message, listCountries().map((x) => ({ name: x.name, iso: x.iso })));
      const guided = c ? await db.select({ id: s.visaGuidance.id }).from(s.visaGuidance).where(and(eq(s.visaGuidance.destinationIso, c.iso), eq(s.visaGuidance.status, "PUBLISHED"))).limit(1) : [];
      if (c) return {
        text: guided.length
          ? `Visa rules for ${c.name} depend on your passport, where you live and why you're travelling. The visa checker shows the official checklist for your situation, with its source and when we last checked it.`
          : `We don't have a published checklist for ${c.name} yet, so the visa checker will offer you a consultation. A consultant will confirm the current requirements with you.`,
        links: [{ label: `Check visa requirements for ${c.name}`, href: `/visa?dest=${c.iso}` }], suggestions: ["Talk to a consultant"],
      };
      return { text: "Tell me which country you want to travel to, or open the visa checker: choose your passport, where you live, your destination and the purpose of the trip.", links: [{ label: "Open the visa checker", href: "/visa" }] };
    }
    default:
      return { text: "I'm not sure I understood. I can help with jobs abroad, study programs and visa requirements, or connect you with a consultant.", suggestions: MENU };
  }
}
