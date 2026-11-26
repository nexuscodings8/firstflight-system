// What the Content Manager can edit: one entry per kind of record. Pages and server actions read these
// definitions, so adding a field here adds it to the form, the validation and the save.
import * as s from "@/db/schema";
import { opts, type Field } from "./fields";

export type EntityKey =
  | "continents" | "countries" | "job-categories" | "jobs" | "universities" | "programs"
  | "visa-categories" | "visa-guidance" | "promotions" | "portfolio" | "testimonials" | "news" | "whatsapp";

export type Group = "Catalogue" | "Visa" | "Website";

export type Entity = {
  key: EntityKey;
  group: Group;
  singular: string;
  plural: string;
  table: (typeof s)[keyof typeof s];
  titleField: string; // shown in lists and the activity log
  fields: Field[];
  slugFrom?: string; // creates a URL slug from this field on first save; the slug never changes afterwards
  hasStatus: boolean; // draft → published → archived
  requirements?: "jobId" | "programId" | "visaGuidanceId"; // has a document checklist
  listColumns: { label: string; field: string; ref?: string }[];
  orderBy: string;
  help?: string;
};

const CURRENCY = opts([["USD", "USD"], ["EUR", "EUR"], ["GBP", "GBP"], ["CAD", "CAD"], ["PLN", "PLN"], ["AED", "AED"], ["QAR", "QAR"], ["RWF", "RWF"]]);
const AVAILABILITY = opts([["OPEN", "Open"], ["CLOSING_SOON", "Closing soon"], ["CLOSED", "Closed"], ["FILLED", "Filled"]]);

export const ENTITIES: Record<EntityKey, Entity> = {
  continents: {
    key: "continents", group: "Catalogue", singular: "continent", plural: "Continents", table: s.continents, titleField: "name", slugFrom: "name", hasStatus: false,
    fields: [{ name: "name", label: "Name", type: "text", required: true, max: 60 }, { name: "sortOrder", label: "Order on the page", type: "int", help: "Smaller numbers come first." }],
    listColumns: [{ label: "Order", field: "sortOrder" }], orderBy: "sortOrder",
  },
  countries: {
    key: "countries", group: "Catalogue", singular: "country", plural: "Countries", table: s.countries, titleField: "name", slugFrom: "name", hasStatus: true,
    help: "A country appears under Work Abroad, Study Abroad or both, depending on the boxes ticked.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 80 },
      { name: "isoCode", label: "Country (for the visa checker and locations)", type: "country", required: true },
      { name: "continentId", label: "Continent", type: "ref", ref: "continents", required: true },
      { name: "workDestination", label: "Show under Work Abroad", type: "checkbox" },
      { name: "studyDestination", label: "Show under Study Abroad", type: "checkbox" },
      { name: "blurb", label: "Short description", type: "textarea", max: 300, wide: true },
      { name: "sortOrder", label: "Order on the page", type: "int" },
    ],
    listColumns: [{ label: "Continent", field: "continentId", ref: "continents" }, { label: "Work", field: "workDestination" }, { label: "Study", field: "studyDestination" }], orderBy: "sortOrder",
  },
  "job-categories": {
    key: "job-categories", group: "Catalogue", singular: "job category", plural: "Job categories", table: s.jobCategories, titleField: "name", slugFrom: "name", hasStatus: false,
    fields: [{ name: "name", label: "Name", type: "text", required: true, max: 60 }], listColumns: [], orderBy: "name",
  },
  jobs: {
    key: "jobs", group: "Catalogue", singular: "job offer", plural: "Job offers", table: s.jobs, titleField: "title", slugFrom: "title", hasStatus: true, requirements: "jobId",
    fields: [
      { name: "title", label: "Job title", type: "text", required: true, max: 120 },
      { name: "countryId", label: "Country", type: "ref", ref: "countries", required: true },
      { name: "location", label: "City or region", type: "text", required: true, max: 80 },
      { name: "categoryId", label: "Category", type: "ref", ref: "job-categories", required: true },
      { name: "employmentType", label: "Employment type", type: "select", required: true, options: opts([["FULL_TIME", "Full time"], ["PART_TIME", "Part time"], ["CONTRACT", "Contract"], ["SEASONAL", "Seasonal"], ["TEMPORARY", "Temporary"]]) },
      { name: "availability", label: "Availability", type: "select", required: true, options: AVAILABILITY },
      { name: "salaryMin", label: "Salary from", type: "money" },
      { name: "salaryMax", label: "Salary to", type: "money" },
      { name: "salaryCurrency", label: "Salary currency", type: "select", required: true, options: CURRENCY },
      { name: "salaryPeriod", label: "Salary per", type: "select", required: true, options: opts([["HOUR", "Hour"], ["DAY", "Day"], ["WEEK", "Week"], ["MONTH", "Month"], ["YEAR", "Year"]]) },
      { name: "deadline", label: "Application deadline", type: "date", endOfDay: true },
      { name: "featured", label: "Feature on the home page", type: "checkbox" },
      { name: "summary", label: "Summary (shown on cards)", type: "textarea", required: true, max: 300, wide: true },
      { name: "description", label: "Job description", type: "textarea", required: true, max: 5000, wide: true },
      { name: "eligibility", label: "Who can apply", type: "textarea", required: true, max: 3000, wide: true },
      { name: "benefits", label: "Benefits", type: "textarea", required: true, max: 3000, wide: true },
    ],
    listColumns: [{ label: "Country", field: "countryId", ref: "countries" }, { label: "Availability", field: "availability" }, { label: "Deadline", field: "deadline" }], orderBy: "title",
  },
  universities: {
    key: "universities", group: "Catalogue", singular: "university", plural: "Universities", table: s.universities, titleField: "name", slugFrom: "name", hasStatus: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 120 },
      { name: "countryId", label: "Country", type: "ref", ref: "countries", required: true },
      { name: "city", label: "City", type: "text", required: true, max: 80 },
      { name: "website", label: "Website", type: "url" },
      { name: "description", label: "Description", type: "textarea", required: true, max: 3000, wide: true },
    ],
    listColumns: [{ label: "Country", field: "countryId", ref: "countries" }, { label: "City", field: "city" }], orderBy: "name",
  },
  programs: {
    key: "programs", group: "Catalogue", singular: "program", plural: "Programs", table: s.programs, titleField: "name", slugFrom: "name", hasStatus: true, requirements: "programId",
    fields: [
      { name: "name", label: "Program name", type: "text", required: true, max: 150 },
      { name: "universityId", label: "University", type: "ref", ref: "universities", required: true },
      { name: "level", label: "Level", type: "select", required: true, options: opts([["FOUNDATION", "Foundation"], ["CERTIFICATE", "Certificate"], ["DIPLOMA", "Diploma"], ["BACHELOR", "Bachelor"], ["MASTER", "Master"], ["PHD", "PhD"], ["LANGUAGE", "Language course"]]) },
      { name: "availability", label: "Availability", type: "select", required: true, options: AVAILABILITY },
      { name: "intakes", label: "Intakes", type: "tags", required: true, help: "Separate with commas, e.g. September 2027, January 2028" },
      { name: "duration", label: "Duration", type: "text", required: true, max: 60, help: "e.g. 3 years" },
      { name: "language", label: "Language of teaching", type: "text", required: true, max: 60 },
      { name: "tuitionAmount", label: "Tuition", type: "money" },
      { name: "tuitionCurrency", label: "Tuition currency", type: "select", required: true, options: CURRENCY },
      { name: "billingPeriod", label: "Tuition per", type: "select", required: true, options: opts([["YEAR", "Year"], ["SEMESTER", "Semester"], ["TERM", "Term"], ["MONTH", "Month"], ["FULL_PROGRAM", "Full program"]]) },
      { name: "deadline", label: "Application deadline", type: "date", endOfDay: true },
      { name: "featured", label: "Feature on the home page", type: "checkbox" },
      { name: "admission", label: "Admission requirements", type: "textarea", required: true, max: 3000, wide: true },
    ],
    listColumns: [{ label: "University", field: "universityId", ref: "universities" }, { label: "Level", field: "level" }, { label: "Availability", field: "availability" }], orderBy: "name",
  },
  "visa-categories": {
    key: "visa-categories", group: "Visa", singular: "visa purpose", plural: "Visa purposes", table: s.visaCategories, titleField: "name", slugFrom: "name", hasStatus: false,
    help: "The purposes visitors choose in the visa checker (tourism, business…).",
    fields: [{ name: "name", label: "Name", type: "text", required: true, max: 60 }, { name: "sortOrder", label: "Order in the list", type: "int" }, { name: "active", label: "Offer in the visa checker", type: "checkbox" }],
    listColumns: [{ label: "Order", field: "sortOrder" }, { label: "Offered", field: "active" }], orderBy: "sortOrder",
  },
  "visa-guidance": {
    key: "visa-guidance", group: "Visa", singular: "visa guidance entry", plural: "Visa guidance", table: s.visaGuidance, titleField: "title", hasStatus: true, requirements: "visaGuidanceId",
    help: "Each entry must cite its official source. Entries not checked for 180 days, or flagged for review, are not shown as a checklist: visitors are offered a consultation instead.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 150, help: "e.g. UK Standard Visitor visa" },
      { name: "destinationIso", label: "Destination country", type: "country", required: true },
      { name: "categoryId", label: "Purpose", type: "ref", ref: "visa-categories", required: true },
      { name: "destinationCity", label: "Only for this city (optional)", type: "text", max: 80, help: "Leave empty for the whole country. City entries add local guidance to the country checklist." },
      { name: "nationalityIso", label: "Only for this passport", type: "country", optionalLabel: "Any passport" },
      { name: "residenceIso", label: "Only for residents of", type: "country", optionalLabel: "Any country of residence" },
      { name: "processingTime", label: "Processing time", type: "text", max: 120 },
      { name: "feeNote", label: "Fee", type: "text", max: 200 },
      { name: "sourceName", label: "Official source name", type: "text", required: true, max: 150, help: "e.g. GOV.UK" },
      { name: "sourceUrl", label: "Official source address", type: "url", required: true },
      { name: "lastCheckedAt", label: "Last checked against the source", type: "date", required: true },
      { name: "reviewState", label: "Review state", type: "select", required: true, options: opts([["CURRENT", "Current"], ["NEEDS_REVIEW", "Needs review (offer a consultation instead)"]]) },
      { name: "summary", label: "Summary", type: "textarea", required: true, max: 2000, wide: true },
      { name: "localGuidance", label: "Local guidance (where to submit, biometrics…)", type: "textarea", max: 2000, wide: true },
    ],
    listColumns: [{ label: "Destination", field: "destinationIso" }, { label: "Purpose", field: "categoryId", ref: "visa-categories" }, { label: "Last checked", field: "lastCheckedAt" }, { label: "Review", field: "reviewState" }], orderBy: "title",
  },
  promotions: {
    key: "promotions", group: "Website", singular: "promotion", plural: "Promotions", table: s.promotions, titleField: "title", hasStatus: true,
    help: "Published promotions show on the home page between their start and end dates, then disappear automatically.",
    fields: [
      { name: "title", label: "Headline", type: "text", required: true, max: 100 },
      { name: "ctaLabel", label: "Button text", type: "text", required: true, max: 40 },
      { name: "ctaUrl", label: "Button link", type: "link", required: true, help: "A page on this site, like /study, or a full web address." },
      { name: "startsAt", label: "Show from", type: "date", required: true },
      { name: "expiresAt", label: "Show until (inclusive)", type: "date", required: true, endOfDay: true },
      { name: "body", label: "Text", type: "textarea", required: true, max: 400, wide: true },
    ],
    listColumns: [{ label: "From", field: "startsAt" }, { label: "Until", field: "expiresAt" }], orderBy: "expiresAt",
  },
  portfolio: {
    key: "portfolio", group: "Website", singular: "portfolio entry", plural: "Portfolio", table: s.portfolioEntries, titleField: "title", hasStatus: true,
    fields: [{ name: "title", label: "Title", type: "text", required: true, max: 120 }, { name: "year", label: "Year", type: "int" }, { name: "sortOrder", label: "Order", type: "int" }, { name: "summary", label: "Summary", type: "textarea", required: true, max: 600, wide: true }],
    listColumns: [{ label: "Year", field: "year" }], orderBy: "sortOrder",
  },
  testimonials: {
    key: "testimonials", group: "Website", singular: "testimonial", plural: "Testimonials", table: s.testimonials, titleField: "clientName", hasStatus: true,
    help: "A testimonial can only be published when the client has given written consent.",
    fields: [
      { name: "clientName", label: "Client name as it should appear", type: "text", required: true, max: 80, help: "e.g. Aline U., Kigali" },
      { name: "service", label: "Service", type: "select", required: true, options: opts([["WORK", "Work Abroad"], ["STUDY", "Study Abroad"], ["VISA", "Visa Processing"]]) },
      { name: "consentGiven", label: "The client gave written consent to publish this", type: "checkbox" },
      { name: "quote", label: "What they said", type: "textarea", required: true, max: 600, wide: true },
    ],
    listColumns: [{ label: "Service", field: "service" }, { label: "Consent", field: "consentGiven" }], orderBy: "clientName",
  },
  news: {
    key: "news", group: "Website", singular: "news post", plural: "News", table: s.newsPosts, titleField: "title", slugFrom: "title", hasStatus: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 150 },
      { name: "excerpt", label: "Short summary (shown in lists)", type: "textarea", required: true, max: 300, wide: true },
      { name: "body", label: "Article", type: "textarea", required: true, max: 20000, wide: true, help: "Leave an empty line between paragraphs." },
    ],
    listColumns: [{ label: "Published", field: "publishedAt" }], orderBy: "title",
  },
  whatsapp: {
    key: "whatsapp", group: "Website", singular: "WhatsApp contact", plural: "WhatsApp contacts", table: s.whatsappContacts, titleField: "name", hasStatus: false,
    help: "Visitors tap the WhatsApp button and choose who to message. Only contacts marked as shown appear.",
    fields: [
      { name: "name", label: "Name shown to visitors", type: "text", required: true, max: 60, help: "e.g. Study Abroad desk" },
      { name: "department", label: "What they help with", type: "text", required: true, max: 80, help: "e.g. Universities, programs and student visas" },
      { name: "number", label: "WhatsApp number", type: "phone", required: true, help: "With country code, e.g. +250 792 881 863" },
      { name: "sortOrder", label: "Order in the list", type: "int" },
      { name: "active", label: "Show on the website", type: "checkbox" },
    ],
    listColumns: [{ label: "Helps with", field: "department" }, { label: "Number", field: "number" }, { label: "Shown", field: "active" }], orderBy: "sortOrder",
  },
};

export const ENTITY_KEYS = Object.keys(ENTITIES) as EntityKey[];
export const getEntity = (key: string) => (ENTITY_KEYS.includes(key as EntityKey) ? ENTITIES[key as EntityKey] : null);
