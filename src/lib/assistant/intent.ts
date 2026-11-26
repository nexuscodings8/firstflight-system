// Works out what a website visitor is asking the assistant. Pure and unit-tested: no database, no AI service.
// The assistant only answers from FIRST FLIGHT's own published data and fixed explanations, and hands anything
// else to a person, so it never invents visa rules or prices.

export type Intent =
  | "greeting" | "human" | "flights" | "jobs" | "study" | "visa" | "fees" | "apply" | "track" | "documents" | "contact" | "thanks" | "unknown";

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}`, "i").test(t));

/** Most specific first: asking for a person always wins; prices and tracking beat the service they mention. */
export function detectIntent(raw: string): Intent {
  const t = raw.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  if (!t.trim()) return "unknown";
  if (has(t, ["human", "person", "agent", "consultant", "staff", "someone", "real people", "call me", "speak to", "talk to"])) return "human";
  if (has(t, ["flight", "flights", "ticket", "tickets", "airline", "fly to", "plane", "air ticket", "booking a flight"])) return "flights";
  if (has(t, ["price", "cost", "fee", "fees", "how much", "charge", "pay", "payment", "invoice", "tuition"])) return "fees";
  if (has(t, ["track", "status", "progress", "my application", "where is my", "update on"])) return "track";
  if (has(t, ["document", "papers", "checklist", "upload", "certificate", "passport copy"])) return "documents";
  if (has(t, ["visa", "permit", "embassy", "entry requirement"])) return "visa";
  if (has(t, ["study", "university", "universities", "college", "program", "programme", "course", "degree", "bachelor", "master", "masters", "phd", "scholarship", "admission", "student"])) return "study";
  if (has(t, ["job", "jobs", "work", "employ", "career", "vacanc", "hiring", "salary", "worker", "driver", "nurse", "caregiver", "farm", "construction", "hotel", "cleaning", "warehouse"])) return "jobs";
  if (has(t, ["apply", "application", "register", "sign up", "account", "how do i start", "how to start"])) return "apply";
  if (has(t, ["contact", "phone", "number", "email", "office", "address", "located", "location", "where are you", "open", "hours", "whatsapp"])) return "contact";
  if (has(t, ["thank", "thanks", "murakoze", "merci", "ok great", "perfect"])) return "thanks";
  if (has(t, ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "muraho", "bonjour", "help"])) return "greeting";
  return "unknown";
}

/** Common short names people type, mapped to ISO codes. */
const ALIASES: Record<string, string> = {
  uk: "GB", "u.k": "GB", britain: "GB", england: "GB", "great britain": "GB", "united kingdom": "GB",
  usa: "US", "u.s": "US", america: "US", "united states": "US", states: "US",
  uae: "AE", dubai: "AE", emirates: "AE", "abu dhabi": "AE", holland: "NL", deutschland: "DE", "south korea": "KR", korea: "KR",
};

/** Finds a country mentioned in the message, from the given list (name + ISO), longest names first. */
export function findCountry<T extends { name: string; iso: string }>(raw: string, countries: T[]): T | null {
  const t = ` ${raw.toLowerCase().replace(/[^a-z.\s]/g, " ").replace(/\s+/g, " ")} `;
  const sorted = [...countries].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) if (t.includes(` ${c.name.toLowerCase()} `)) return c;
  for (const [alias, iso] of Object.entries(ALIASES)) {
    if (t.includes(` ${alias} `) || t.includes(` ${alias}.`)) { const c = countries.find((x) => x.iso === iso); if (c) return c; }
  }
  return null;
}

/** Words worth searching job titles and program names with ("nursing jobs in canada" → "nursing"). */
export function keywords(raw: string, countryName?: string) {
  const stop = new Set(["i", "a", "an", "the", "in", "to", "for", "of", "and", "or", "me", "my", "is", "are", "do", "you", "have", "any", "want", "would", "like", "looking", "find", "show", "there", "please", "can", "with", "job", "jobs", "work", "working", "abroad", "study", "studying", "program", "programs", "programme", "course", "courses", "university", "universities", "degree", "available", "offer", "offers", "about", "what", "which", "where", "how", "some", "get", "need", "go", "going", "country", "countries"]);
  const cn = (countryName ?? "").toLowerCase().split(/\s+/);
  return raw.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w) && !cn.includes(w)).slice(0, 3);
}

/** Program level words → catalogue level. */
export function findLevel(raw: string) {
  const t = raw.toLowerCase();
  if (/\b(phd|doctorate)\b/.test(t)) return "PHD";
  if (/\bmasters?\b|\bmsc\b|\bmba\b|\bpostgrad/.test(t)) return "MASTER";
  if (/\bbachelors?\b|\bundergrad|\bbsc\b|\bba\b/.test(t)) return "BACHELOR";
  if (/\bdiploma\b/.test(t)) return "DIPLOMA";
  if (/\bfoundation\b/.test(t)) return "FOUNDATION";
  if (/\blanguage course|\blearn (english|german|french)/.test(t)) return "LANGUAGE";
  return undefined;
}
