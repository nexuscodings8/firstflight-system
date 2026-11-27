// Sample data for the TEST environment only. Real listings, guidance and contacts are entered by staff.
// Run: npm run db:seed   (wipes and re-creates all sample rows)
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as s from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });
const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const slug = (x: string) => x.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SAMPLE = "Sample guidance for the test environment: confirm against the official source before publishing.";

async function main() {
  const pw = process.env.SEED_PASSWORD;
  if (!pw || pw.length < 10) throw new Error("Set SEED_PASSWORD (10+ characters) before seeding.");
  await db.execute(sql`truncate table activities, notifications, payments, invoices, application_updates, documents,
    checklist_items, applications, enquiries, requirement_items, visa_guidance, visa_categories, programs, universities,
    jobs, job_categories, countries, continents, promotions, portfolio_entries, testimonials, news_posts, whatsapp_contacts,
    counters, email_log, refund_requests, amendment_requests, fee_rules, sessions, consultant_services, assignment_requests,
    assignment_history, account_tokens, settings, contract_templates, contracts, appointments, payment_submissions,
    messages, conversation_members, conversations, case_files, historical_payments, loan_requests, users restart identity cascade`);

  // ---------- people ----------
  const hash = await bcrypt.hash(pw, 12);
  const [admin, consultant, consultant2, finance, content, client] = await db.insert(s.users).values([
    { email: "admin@firstflight.test", name: "Claudine Mukeshimana", role: "ADMIN", passwordHash: hash },
    { email: "consultant@firstflight.test", name: "Sandrine Umutoni", role: "CONSULTANT", passwordHash: hash },
    { email: "consultant2@firstflight.test", name: "Yves Ndayisaba", role: "CONSULTANT", passwordHash: hash },
    { email: "finance@firstflight.test", name: "Olivier Kayitare", role: "FINANCE", passwordHash: hash },
    { email: "content@firstflight.test", name: "Kevin Mugisha", role: "CONTENT_MANAGER", passwordHash: hash },
    { email: "client@firstflight.test", name: "Aline Uwase", role: "CLIENT", phone: "+250 788 000 101", passwordHash: hash },
  ]).returning();

  // ---------- places ----------
  const cont = Object.fromEntries((await db.insert(s.continents).values([
    { name: "Europe", slug: "europe", sortOrder: 1 },
    { name: "North America", slug: "north-america", sortOrder: 2 },
    { name: "Asia", slug: "asia", sortOrder: 3 },
  ]).returning()).map((c) => [c.slug, c]));
  const C = [
    ["Netherlands", "NL", "europe", true, true, "Skilled and seasonal roles with strong worker protections."],
    ["Canada", "CA", "north-america", true, true, "Employer-supported roles and respected universities."],
    ["United States", "US", "north-america", true, true, "Seasonal and skilled roles, and a wide choice of universities."],
    ["Qatar", "QA", "asia", true, false, "Hospitality, construction and service roles."],
    ["United Arab Emirates", "AE", "asia", true, false, "Hospitality, retail and logistics roles in Dubai and Abu Dhabi."],
    ["Germany", "DE", "europe", true, true, "Care, logistics and technical roles, with English-taught programs."],
    ["United Kingdom", "GB", "europe", false, true, "Foundation, bachelor and master routes."],
    ["Poland", "PL", "europe", false, true, "Affordable English-taught degrees in Central Europe."],
  ] as const;
  const ctry = Object.fromEntries((await db.insert(s.countries).values(C.map(([name, iso, c, w, st, blurb], i) => ({
    name, isoCode: iso, slug: slug(name), continentId: cont[c].id, workDestination: w, studyDestination: st, blurb, sortOrder: i,
  }))).returning()).map((c) => [c.isoCode, c]));

  // ---------- work abroad ----------
  const cat = Object.fromEntries((await db.insert(s.jobCategories).values(
    ["Healthcare and care", "Hospitality", "Logistics and driving", "Construction", "Agriculture", "Engineering and IT"].map((n) => ({ name: n, slug: slug(n) })),
  ).returning()).map((c) => [c.slug, c]));
  type J = [string, string, string, string, "FULL_TIME" | "CONTRACT" | "SEASONAL", number, number, string, "HOUR" | "MONTH", number, string, string[], string[]];
  const J: J[] = [
    ["NL", "Greenhouse production worker", "Westland", "agriculture", "SEASONAL", 2300, 2500, "EUR", "MONTH", 40, "Planting, harvesting and packing in modern greenhouses.", ["Passport copy", "CV", "Passport photo"], ["Reference letter"]],
    ["NL", "Warehouse order picker", "Venlo", "logistics-and-driving", "CONTRACT", 2350, 2600, "EUR", "MONTH", 30, "Order picking and packing in a distribution centre, shift work.", ["Passport copy", "CV"], ["Forklift certificate"]],
    ["CA", "Long-haul truck driver", "Winnipeg, Manitoba", "logistics-and-driving", "FULL_TIME", 26, 30, "CAD", "HOUR", 45, "Cross-province freight routes for an established carrier.", ["Passport copy", "CV", "Driving licence (class C or above)", "Police clearance certificate"], ["Driving experience letter"]],
    ["CA", "Food counter attendant", "Calgary, Alberta", "hospitality", "FULL_TIME", 17, 18, "CAD", "HOUR", 20, "Food preparation and customer service in a busy restaurant.", ["Passport copy", "CV"], ["Reference letter"]],
    ["US", "Seasonal resort staff", "Orlando, Florida", "hospitality", "SEASONAL", 16, 18, "USD", "HOUR", 35, "Guest services, housekeeping and food service at a resort.", ["Passport copy", "CV", "Passport photo"], ["English test result"]],
    ["US", "Farm equipment operator", "Fresno, California", "agriculture", "SEASONAL", 18, 20, "USD", "HOUR", 50, "Operating and maintaining farm machinery during harvest season.", ["Passport copy", "CV", "Driving licence"], ["Machinery training certificate"]],
    ["QA", "Hotel housekeeping attendant", "Doha", "hospitality", "CONTRACT", 1800, 2200, "QAR", "MONTH", 25, "Room preparation and housekeeping in an international hotel.", ["Passport copy", "CV", "Passport photo", "Medical fitness certificate"], []],
    ["QA", "Construction site electrician", "Lusail", "construction", "CONTRACT", 3000, 3800, "QAR", "MONTH", 40, "Electrical installation and maintenance on large building projects.", ["Passport copy", "CV", "Trade certificate", "Police clearance certificate"], ["Experience letter"]],
    ["AE", "Retail sales associate", "Dubai", "hospitality", "FULL_TIME", 2500, 3200, "AED", "MONTH", 15, "Customer service and sales in a flagship mall store.", ["Passport copy", "CV", "Passport photo"], ["Reference letter"]],
    ["AE", "Delivery driver", "Abu Dhabi", "logistics-and-driving", "FULL_TIME", 2800, 3500, "AED", "MONTH", 30, "Last-mile delivery for an e-commerce company; vehicle provided.", ["Passport copy", "CV", "Driving licence"], ["UAE licence, if held"]],
    ["DE", "Care assistant, elderly care", "Munich", "healthcare-and-care", "FULL_TIME", 2400, 2800, "EUR", "MONTH", 60, "Daily care support in licensed care homes, with German language training.", ["Passport copy", "CV", "Academic certificates", "Police clearance certificate"], ["Caregiving training certificate", "German language certificate"]],
    ["DE", "IT support technician", "Berlin", "engineering-and-it", "FULL_TIME", 3200, 3800, "EUR", "MONTH", -5, "First and second-line IT support for a logistics company.", ["Passport copy", "CV", "Diploma or degree certificate"], ["IT certifications"]],
  ];
  for (const [i, [iso, title, loc, c, type, min, max, cur, per, dl, summary, mand, opt]] of J.entries()) {
    const [job] = await db.insert(s.jobs).values({
      slug: slug(`${title}-${iso}`), title, countryId: ctry[iso].id, location: loc, categoryId: cat[c].id, employmentType: type,
      summary, description: `${summary} The employer provides an employment contract and onboarding support. FIRST FLIGHT guides you through the application, documents and travel.`,
      eligibility: "Age 21 to 45. Relevant experience preferred. Able to pass a medical check. Clean police record.",
      benefits: "Employment contract, onboarding support and help with accommodation on arrival.",
      salaryMin: String(min), salaryMax: String(max), salaryCurrency: cur, salaryPeriod: per,
      deadline: days(dl), availability: dl < 0 ? "CLOSED" : dl <= 20 ? "CLOSING_SOON" : "OPEN",
      status: "PUBLISHED", featured: i % 4 === 0,
    }).returning();
    await db.insert(s.requirementItems).values([
      ...mand.map((label, k) => ({ label, mandatory: true, sortOrder: k, jobId: job.id })),
      ...opt.map((label, k) => ({ label, mandatory: false, sortOrder: 10 + k, jobId: job.id })),
    ]);
  }

  // ---------- study abroad ----------
  const U = [
    ["University of Manitoba", "CA", "Winnipeg", "https://umanitoba.ca", "Public research university in Winnipeg."],
    ["Arizona State University", "US", "Tempe", "https://www.asu.edu", "Large public research university in the Phoenix area."],
    ["Coventry University", "GB", "Coventry", "https://www.coventry.ac.uk", "Public university in the West Midlands with foundation and degree routes."],
    ["University of Groningen", "NL", "Groningen", "https://www.rug.nl", "Research university in the north of the Netherlands with English-taught programs."],
    ["University of Europe for Applied Sciences", "DE", "Berlin", "https://www.ue-germany.com", "Private university with English-taught applied programs."],
    ["Warsaw University of Technology", "PL", "Warsaw", "https://www.pw.edu.pl", "Technical university in Warsaw with English-taught programs."],
  ] as const;
  type P = [string, "FOUNDATION" | "BACHELOR" | "MASTER", string[], string, number, string, "YEAR" | "FULL_PROGRAM", string[], string[]];
  const P: Record<string, P[]> = {
    CA: [["MSc Data Science", "MASTER", ["September 2027"], "2 years", 21000, "CAD", "YEAR", ["Passport copy", "Academic transcripts", "Bachelor diploma", "English test result", "Motivation letter"], ["Recommendation letters"]],
         ["Bachelor of Commerce", "BACHELOR", ["September 2027", "January 2028"], "4 years", 19000, "CAD", "YEAR", ["Passport copy", "Secondary school transcripts", "Secondary school certificate", "English test result"], ["Motivation letter"]]],
    US: [["BSc Computer Science", "BACHELOR", ["August 2027", "January 2028"], "4 years", 33000, "USD", "YEAR", ["Passport copy", "Secondary school transcripts", "English test result", "Proof of funds"], ["Personal statement"]],
         ["MBA", "MASTER", ["August 2027"], "2 years", 36000, "USD", "YEAR", ["Passport copy", "Academic transcripts", "Bachelor diploma", "CV", "English test result"], ["Recommendation letters"]]],
    GB: [["International Foundation Year", "FOUNDATION", ["September 2027", "January 2028"], "1 year", 12000, "GBP", "FULL_PROGRAM", ["Passport copy", "Secondary school certificate", "English test result"], ["Personal statement"]],
         ["MSc International Business", "MASTER", ["September 2027", "January 2028", "May 2028"], "1 year", 18000, "GBP", "FULL_PROGRAM", ["Passport copy", "Academic transcripts", "Bachelor diploma", "English test result"], ["CV"]]],
    NL: [["MSc Artificial Intelligence", "MASTER", ["September 2027"], "2 years", 23000, "EUR", "YEAR", ["Passport copy", "Academic transcripts", "Bachelor diploma", "English test result", "Motivation letter"], ["CV"]],
         ["BSc International Business", "BACHELOR", ["September 2027"], "3 years", 13000, "EUR", "YEAR", ["Passport copy", "Secondary school transcripts", "English test result"], ["Motivation letter"]]],
    DE: [["BA Business and Management", "BACHELOR", ["October 2027", "March 2028"], "3 years", 9000, "EUR", "YEAR", ["Passport copy", "Secondary school certificate", "English test result"], ["CV"]],
         ["MSc Software Engineering", "MASTER", ["October 2027", "March 2028"], "1.5 years", 10000, "EUR", "YEAR", ["Passport copy", "Academic transcripts", "Bachelor diploma", "English test result"], ["Motivation letter"]]],
    PL: [["MSc Computer Science", "MASTER", ["October 2027"], "1.5 years", 4000, "EUR", "YEAR", ["Passport copy", "Academic transcripts", "Bachelor diploma", "English test result"], ["Motivation letter"]],
         ["BSc Civil Engineering", "BACHELOR", ["October 2027"], "3.5 years", 3500, "EUR", "YEAR", ["Passport copy", "Secondary school certificate", "Secondary school transcripts", "English test result"], []]],
  };
  for (const [name, iso, city, web, desc] of U) {
    const [uni] = await db.insert(s.universities).values({ slug: slug(name), name, countryId: ctry[iso].id, city, website: web, description: desc }).returning();
    for (const [k, [pn, level, intakes, dur, fee, cur, per, mand, opt]] of P[iso].entries()) {
      const [prog] = await db.insert(s.programs).values({
        slug: slug(`${pn}-${name}`), universityId: uni.id, name: pn, level, intakes, duration: dur,
        admission: level === "MASTER" ? "Bachelor degree in a related field with good grades." : level === "BACHELOR" ? "Secondary school certificate with good grades." : "Completed secondary school.",
        language: "English: IELTS 6.0–6.5 or equivalent.", tuitionAmount: String(fee), tuitionCurrency: cur, billingPeriod: per,
        deadline: days(60 + k * 15), status: "PUBLISHED", featured: k === 0 && ["CA", "NL", "GB"].includes(iso),
      }).returning();
      await db.insert(s.requirementItems).values([
        ...mand.map((label, j) => ({ label, mandatory: true, sortOrder: j, programId: prog.id })),
        ...opt.map((label, j) => ({ label, mandatory: false, sortOrder: 10 + j, programId: prog.id })),
      ]);
    }
  }

  // ---------- visa processing ----------
  const vc = Object.fromEntries((await db.insert(s.visaCategories).values(
    ["Tourist", "Family visit", "Business", "Conference", "Transit"].map((n, i) => ({ name: n, slug: slug(n), sortOrder: i })),
  ).returning()).map((c) => [c.slug, c]));
  const base = ["Valid passport", "Recent passport photo", "Completed application form", "Bank statements for the last 6 months"];
  type G = { dest: string; cat: string; title: string; src: [string, string]; extra: string[]; opt?: string[]; city?: string; local?: string; nat?: string; review?: boolean; checked?: number; proc?: string };
  const G: G[] = [
    { dest: "GB", cat: "tourist", title: "UK Standard Visitor visa (tourism)", src: ["GOV.UK", "https://www.gov.uk/standard-visitor"], extra: ["Travel itinerary", "Accommodation details"], opt: ["Employment letter"], proc: "Usually about 3 weeks after biometrics" },
    { dest: "GB", cat: "tourist", city: "London", title: "Visiting London: local guidance", src: ["GOV.UK", "https://www.gov.uk/standard-visitor"], extra: [], opt: ["Invitation letter from your London host"], local: "If you stay with a host in London, add their invitation letter and proof of address." },
    { dest: "GB", cat: "family-visit", title: "UK Standard Visitor visa (visiting family)", src: ["GOV.UK", "https://www.gov.uk/standard-visitor"], extra: ["Invitation letter from your relative", "Copy of your relative's UK residence status"], opt: ["Proof of relationship"] },
    { dest: "GB", cat: "business", title: "UK Standard Visitor visa (business)", src: ["GOV.UK", "https://www.gov.uk/standard-visitor"], extra: ["Invitation letter from the UK company", "Letter from your employer"] },
    { dest: "GB", cat: "conference", title: "UK Standard Visitor visa (conference)", src: ["GOV.UK", "https://www.gov.uk/standard-visitor"], extra: ["Conference registration or invitation", "Letter from your employer"] },
    { dest: "GB", cat: "transit", title: "UK transit: check whether you need a visa", src: ["GOV.UK", "https://www.gov.uk/check-uk-visa"], extra: ["Onward flight ticket", "Visa for your final destination, if required"], review: true },
    { dest: "CA", cat: "tourist", title: "Canada visitor visa", src: ["Government of Canada", "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html"], extra: ["Travel history", "Purpose of travel letter"], proc: "Varies by country of residence" },
    { dest: "CA", cat: "family-visit", title: "Canada visitor visa (visiting family)", src: ["Government of Canada", "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html"], extra: ["Invitation letter from your relative in Canada", "Proof of your relative's status in Canada"] },
    { dest: "US", cat: "tourist", title: "US visitor visa (B-2)", src: ["U.S. Department of State", "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"], extra: ["DS-160 confirmation page", "Interview appointment confirmation"], proc: "Depends on interview wait times" },
    { dest: "US", cat: "business", title: "US visitor visa (B-1 business)", src: ["U.S. Department of State", "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html"], extra: ["DS-160 confirmation page", "Letter from the US company", "Letter from your employer"] },
    { dest: "AE", cat: "tourist", title: "UAE tourist visa", src: ["UAE Government portal", "https://u.ae/en/information-and-services/visa-and-emirates-id"], extra: ["Return flight booking", "Hotel booking or host address"] },
    { dest: "AE", cat: "tourist", city: "Dubai", title: "Visiting Dubai: local guidance", src: ["UAE Government portal", "https://u.ae/en/information-and-services/visa-and-emirates-id"], extra: [], local: "For Dubai, keep your hotel confirmation ready; it may be checked on arrival." },
    { dest: "DE", cat: "tourist", title: "Germany Schengen visa (tourism)", src: ["German Federal Foreign Office", "https://www.auswaertiges-amt.de/en/visa-service"], extra: ["Travel medical insurance", "Return flight booking", "Accommodation details"] },
    { dest: "DE", cat: "conference", title: "Germany Schengen visa (conference)", src: ["German Federal Foreign Office", "https://www.auswaertiges-amt.de/en/visa-service"], extra: ["Conference invitation", "Travel medical insurance", "Letter from your employer"] },
    { dest: "NL", cat: "tourist", title: "Netherlands Schengen visa (tourism)", src: ["Netherlands Worldwide", "https://www.netherlandsworldwide.nl/visa-the-netherlands"], extra: ["Travel medical insurance", "Return flight booking"], checked: 240 },
    { dest: "QA", cat: "transit", title: "Qatar transit", src: ["Visit Qatar", "https://visitqatar.com"], extra: ["Onward flight ticket"], review: true },
  ];
  for (const g of G) {
    const [row] = await db.insert(s.visaGuidance).values({
      destinationIso: g.dest, destinationCity: g.city ?? null, categoryId: vc[g.cat].id, nationalityIso: g.nat ?? null,
      title: g.title, summary: `${g.city ? "Extra guidance for this city. " : ""}${SAMPLE}`, processingTime: g.proc ?? null,
      feeNote: g.city ? null : "See the official source for the current fee.", localGuidance: g.local ?? null,
      sourceName: g.src[0], sourceUrl: g.src[1], lastCheckedAt: days(-(g.checked ?? 14)),
      reviewState: g.review ? "NEEDS_REVIEW" : "CURRENT", status: "PUBLISHED", updatedById: content.id,
    }).returning();
    const mand = g.city ? g.extra : [...base, ...g.extra];
    const items = [
      ...mand.map((label, k) => ({ label, mandatory: true, sortOrder: k, visaGuidanceId: row.id })),
      ...(g.opt ?? []).map((label, k) => ({ label, mandatory: false, sortOrder: 20 + k, visaGuidanceId: row.id })),
    ];
    if (items.length) await db.insert(s.requirementItems).values(items);
  }

  // ---------- website content ----------
  await db.insert(s.promotions).values([
    { title: "September intake: application support", body: "Book a free study consultation before the end of the month and get help choosing your program.", ctaLabel: "Explore programs", ctaUrl: "/study", startsAt: days(-3), expiresAt: days(30), status: "PUBLISHED" },
    { title: "Expired promotion (test)", body: "This promotion has expired and must not appear on the website.", ctaLabel: "View", ctaUrl: "/work", startsAt: days(-40), expiresAt: days(-5), status: "PUBLISHED" },
  ]);
  await db.insert(s.newsPosts).values([
    { slug: "plan-visa-appointments-early", title: "Plan visa appointments early for the holiday season", excerpt: "Appointment slots fill quickly in December and January.", body: "Appointment slots fill quickly in December and January. If you plan to travel then, start your visa file now so there is time for any extra documents.", publishedAt: days(-4), status: "PUBLISHED" },
    { slug: "september-intake-open", title: "September study intake applications are open", excerpt: "Universities in Canada, the UK and the Netherlands are accepting applications.", body: "Universities in Canada, the UK and the Netherlands are accepting applications for September. Our consultants can help you choose a program and prepare your documents.", publishedAt: days(-9), status: "PUBLISHED" },
  ]);
  await db.insert(s.whatsappContacts).values([
    { name: "FIRST FLIGHT office", department: "General enquiries", number: "250792881863", sortOrder: 1 },
    { name: "FIRST FLIGHT office", department: "Work and study abroad", number: "250792870300", sortOrder: 2 },
    { name: "FIRST FLIGHT office", department: "Visa processing", number: "250787720747", sortOrder: 3 },
  ]);

  // ---------- which services each demo consultant handles ----------
  await db.insert(s.consultantServices).values([
    ...(["WORK", "STUDY", "VISA", "FLIGHT"] as const).map((service) => ({ userId: consultant.id, service, grantedById: admin.id })),
    ...(["STUDY", "VISA", "FLIGHT"] as const).map((service) => ({ userId: consultant2.id, service, grantedById: admin.id })),
  ]);

  // ---------- sample service fees (private; Finance applies them to applications) ----------
  await db.insert(s.feeRules).values([
    { name: "Work placement (general)", service: "WORK" as const, amount: "1200.00", currency: "USD", installments: [{ label: "Deposit", percent: 40, dueDays: 0 }, { label: "Second instalment", percent: 30, dueDays: 30 }, { label: "Final balance", percent: 30, dueDays: 60 }], createdById: finance.id },
    { name: "Netherlands work placement", service: "WORK" as const, countryId: ctry.NL.id, amount: "1500.00", currency: "EUR", installments: [{ label: "Deposit", percent: 40, dueDays: 0 }, { label: "On work permit approval", percent: 30, dueDays: 45 }, { label: "Before travel", percent: 30, dueDays: 90 }], createdById: finance.id },
    { name: "Study admission support", service: "STUDY" as const, amount: "900.00", currency: "USD", installments: [{ label: "Application fee", percent: 50, dueDays: 0 }, { label: "On admission", percent: 50, dueDays: 60 }], createdById: finance.id },
    { name: "Visa file preparation", service: "VISA" as const, amount: "150.00", currency: "USD", installments: [{ label: "Visa service fee", percent: 100, dueDays: 0 }], createdById: finance.id },
  ]);

  // ---------- one demo application for the demo client (already assigned) ----------
  const demoJob = await db.query.jobs.findFirst({ where: (j, { eq }) => eq(j.slug, "greenhouse-production-worker-nl"), with: { country: true, category: true, requirements: true } });
  if (demoJob) {
    await db.insert(s.counters).values({ key: `FF-WA-${new Date().getFullYear()}`, value: 1 });
    const [app] = await db.insert(s.applications).values({
      reference: `FF-WA-${new Date().getFullYear()}-0001`, service: "WORK", clientId: client.id, consultantId: consultant.id, jobId: demoJob.id, stage: "ELIGIBILITY_REVIEW",
      selection: { title: demoJob.title, details: [["Destination", demoJob.country.name], ["Location", demoJob.location], ["Category", demoJob.category.name]], visa: null, submittedAt: days(-6).toISOString() },
      createdAt: days(-6),
    }).returning();
    await db.insert(s.checklistItems).values(demoJob.requirements.sort((x, y) => x.sortOrder - y.sortOrder).map((r, i) => ({ applicationId: app.id, label: r.label, mandatory: r.mandatory, sortOrder: i })));
    await db.insert(s.applicationUpdates).values({ applicationId: app.id, authorId: consultant.id, body: "Thanks for applying. Please upload your passport copy and CV so I can start your eligibility review.", visibility: "CLIENT", createdAt: days(-5) });
    await db.insert(s.activities).values([
      { actorId: client.id, action: "application.submitted", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${client.name} submitted ${app.reference}: ${demoJob.title}`, createdAt: days(-6) },
      { actorId: admin.id, action: "application.assigned", entityType: "application", entityId: app.id, applicationId: app.id, summary: `${admin.name} assigned ${app.reference} to ${consultant.name}`, createdAt: days(-6) },
    ]);
    await db.insert(s.assignmentHistory).values({ applicationId: app.id, toConsultantId: consultant.id, changedById: admin.id, kind: "ASSIGNED", reason: "Demo assignment", createdAt: days(-6) });
    await db.insert(s.notifications).values({ userId: client.id, title: "Your consultant is assigned", body: `${consultant.name} is now handling ${app.reference}.`, link: `/portal/applications/${app.id}`, createdAt: days(-6) });
  }

  console.log("Seeded. Staff and demo accounts use SEED_PASSWORD:", [admin, consultant, consultant2, finance, content, client].map((u) => u.email).join(", "));
}

main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
