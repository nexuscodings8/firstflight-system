// FIRST FLIGHT BEST TRAVEL SOLUTION LTD: one shared database for the website and every portal.
// Each record has a unique id; links between departments are real foreign keys.
import { relations, sql } from "drizzle-orm";
import {
  boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

// ---------- enums ----------
export const role = pgEnum("role", ["CLIENT", "CONSULTANT", "FINANCE", "ADMIN", "CONTENT_MANAGER"]);
export const publishStatus = pgEnum("publish_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const employmentType = pgEnum("employment_type", ["FULL_TIME", "PART_TIME", "CONTRACT", "SEASONAL", "TEMPORARY"]);
export const payPeriod = pgEnum("pay_period", ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]);
export const availability = pgEnum("availability", ["OPEN", "CLOSING_SOON", "CLOSED", "FILLED"]);
export const studyLevel = pgEnum("study_level", ["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELOR", "MASTER", "PHD", "LANGUAGE"]);
export const billingPeriod = pgEnum("billing_period", ["YEAR", "SEMESTER", "TERM", "MONTH", "FULL_PROGRAM"]);
export const reviewState = pgEnum("review_state", ["CURRENT", "NEEDS_REVIEW"]);
export const serviceType = pgEnum("service_type", ["WORK", "STUDY", "VISA"]);
export const stage = pgEnum("stage", ["SUBMITTED", "ELIGIBILITY_REVIEW", "INITIAL_PAYMENT", "DOCUMENT_SIGNING", "PROCESSING", "FINAL_COLLECTION", "COMPLETED"]);
export const applicationStatus = pgEnum("application_status", ["ACTIVE", "COMPLETED", "NOT_ELIGIBLE", "UNSUCCESSFUL", "WITHDRAWN"]);
export const checklistState = pgEnum("checklist_state", ["PENDING", "REQUESTED", "UPLOADED", "VERIFIED", "REJECTED"]);
export const updateVisibility = pgEnum("update_visibility", ["CLIENT", "INTERNAL"]);
export const enquiryType = pgEnum("enquiry_type", ["PROGRAM_GUIDANCE", "VISA_CONSULTATION", "JOB_QUESTION", "GENERAL", "CHATBOT_HANDOFF", "FLIGHT_BOOKING"]);
export const enquiryStatus = pgEnum("enquiry_status", ["NEW", "IN_PROGRESS", "CLOSED"]);
export const invoiceStatus = pgEnum("invoice_status", ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"]);
export const paymentMethod = pgEnum("payment_method", ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD"]);

// ---------- people and access ----------
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: role("role").notNull().default("CLIENT"),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false), // set for temporary passwords
  createdAt: created(),
  updatedAt: updated(),
});

// The cookie holds a random token; only its SHA-256 hash is stored here.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// ---------- catalogue: places ----------
export const continents = pgTable("continents", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const countries = pgTable("countries", {
  id: id(),
  name: text("name").notNull(),
  isoCode: text("iso_code").notNull().unique(), // ISO 3166-1 alpha-2, same codes as the locations API
  slug: text("slug").notNull().unique(),
  continentId: text("continent_id").references(() => continents.id),
  workDestination: boolean("work_destination").notNull().default(false),
  studyDestination: boolean("study_destination").notNull().default(false),
  blurb: text("blurb"),
  status: publishStatus("status").notNull().default("PUBLISHED"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------- catalogue: work abroad ----------
export const jobCategories = pgTable("job_categories", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const jobs = pgTable("jobs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  countryId: text("country_id").notNull().references(() => countries.id),
  location: text("location").notNull(),
  categoryId: text("category_id").notNull().references(() => jobCategories.id),
  employmentType: employmentType("employment_type").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  eligibility: text("eligibility").notNull(),
  benefits: text("benefits").notNull(),
  salaryMin: numeric("salary_min", { precision: 12, scale: 2 }),
  salaryMax: numeric("salary_max", { precision: 12, scale: 2 }),
  salaryCurrency: text("salary_currency").notNull().default("USD"),
  salaryPeriod: payPeriod("salary_period").notNull().default("MONTH"),
  deadline: timestamp("deadline", { withTimezone: true }),
  availability: availability("availability").notNull().default("OPEN"),
  status: publishStatus("status").notNull().default("DRAFT"),
  featured: boolean("featured").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("jobs_country_status_idx").on(t.countryId, t.status), index("jobs_category_idx").on(t.categoryId)]);

// ---------- catalogue: study abroad ----------
export const universities = pgTable("universities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  countryId: text("country_id").notNull().references(() => countries.id),
  city: text("city").notNull(),
  website: text("website"),
  description: text("description").notNull(),
  status: publishStatus("status").notNull().default("PUBLISHED"),
}, (t) => [index("universities_country_idx").on(t.countryId)]);

export const programs = pgTable("programs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  universityId: text("university_id").notNull().references(() => universities.id),
  name: text("name").notNull(),
  level: studyLevel("level").notNull(),
  intakes: text("intakes").array().notNull().default(sql`'{}'::text[]`),
  duration: text("duration").notNull(),
  admission: text("admission").notNull(),
  language: text("language").notNull(),
  tuitionAmount: numeric("tuition_amount", { precision: 12, scale: 2 }),
  tuitionCurrency: text("tuition_currency").notNull().default("USD"),
  billingPeriod: billingPeriod("billing_period").notNull().default("YEAR"),
  deadline: timestamp("deadline", { withTimezone: true }),
  availability: availability("availability").notNull().default("OPEN"),
  status: publishStatus("status").notNull().default("DRAFT"),
  featured: boolean("featured").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("programs_university_status_idx").on(t.universityId, t.status)]);

// ---------- catalogue: visa processing ----------
export const visaCategories = pgTable("visa_categories", {
  id: id(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// Source-backed guidance kept by staff. Matching picks the most specific published entry for the
// destination + purpose (nationality, residence, city). Missing, stale or flagged entries route to a consultation.
export const visaGuidance = pgTable("visa_guidance", {
  id: id(),
  destinationIso: text("destination_iso").notNull(),
  destinationCity: text("destination_city"), // null: whole country
  categoryId: text("category_id").notNull().references(() => visaCategories.id),
  nationalityIso: text("nationality_iso"), // null: any passport
  residenceIso: text("residence_iso"), // null: any country of residence
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  processingTime: text("processing_time"),
  feeNote: text("fee_note"),
  localGuidance: text("local_guidance"), // e.g. where to submit biometrics in this city
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull(),
  reviewState: reviewState("review_state").notNull().default("CURRENT"),
  status: publishStatus("status").notNull().default("DRAFT"),
  updatedById: text("updated_by_id").references(() => users.id),
  updatedAt: updated(),
}, (t) => [index("visa_guidance_lookup_idx").on(t.destinationIso, t.categoryId, t.status)]);

// Document checklist templates shared by jobs, programs and visa guidance.
export const requirementItems = pgTable("requirement_items", {
  id: id(),
  label: text("label").notNull(),
  mandatory: boolean("mandatory").notNull().default(true),
  note: text("note"),
  sortOrder: integer("sort_order").notNull().default(0),
  jobId: text("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  programId: text("program_id").references(() => programs.id, { onDelete: "cascade" }),
  visaGuidanceId: text("visa_guidance_id").references(() => visaGuidance.id, { onDelete: "cascade" }),
});

// ---------- applications and enquiries ----------
export const applications = pgTable("applications", {
  id: id(),
  reference: text("reference").notNull().unique(), // FF-WA-2026-0001
  service: serviceType("service").notNull(),
  clientId: text("client_id").notNull().references(() => users.id),
  consultantId: text("consultant_id").references(() => users.id),
  jobId: text("job_id").references(() => jobs.id),
  programId: text("program_id").references(() => programs.id),
  visaGuidanceId: text("visa_guidance_id").references(() => visaGuidance.id),
  selection: jsonb("selection").notNull(), // snapshot of the client's choice at submission
  clientNote: text("client_note"),
  feePlan: jsonb("fee_plan"), // agreed service fee and instalments, copied from the fee rule when applied (never changes afterwards)
  feePlanHistory: jsonb("fee_plan_history"), // earlier agreed plans, kept when an approved amendment changes the fee
  previousApplicationId: text("previous_application_id"), // set when this is an approved reapplication
  stage: stage("stage").notNull().default("SUBMITTED"),
  status: applicationStatus("status").notNull().default("ACTIVE"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("applications_client_idx").on(t.clientId), index("applications_consultant_idx").on(t.consultantId), index("applications_status_stage_idx").on(t.status, t.stage)]);

export const checklistItems = pgTable("checklist_items", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  mandatory: boolean("mandatory").notNull().default(true),
  state: checklistState("state").notNull().default("PENDING"),
  note: text("note"), // consultant's request or rejection reason, shown to the client
  requestedById: text("requested_by_id").references(() => users.id),
  reviewedById: text("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: updated(),
}, (t) => [index("checklist_application_idx").on(t.applicationId)]);

export const documents = pgTable("documents", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  checklistItemId: text("checklist_item_id").references(() => checklistItems.id, { onDelete: "set null" }),
  uploadedById: text("uploaded_by_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull().unique(), // opaque key; never a public URL
  createdAt: created(),
}, (t) => [index("documents_application_idx").on(t.applicationId)]);

export const applicationUpdates = pgTable("application_updates", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  visibility: updateVisibility("visibility").notNull().default("CLIENT"),
  createdAt: created(),
}, (t) => [index("updates_application_idx").on(t.applicationId)]);

export const enquiries = pgTable("enquiries", {
  id: id(),
  reference: text("reference").notNull().unique(),
  type: enquiryType("type").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  context: jsonb("context"), // carried selections: program, university, visa inputs, page
  clientId: text("client_id").references(() => users.id),
  assignedToId: text("assigned_to_id").references(() => users.id),
  status: enquiryStatus("status").notNull().default("NEW"),
  resolution: text("resolution"), // staff summary of the answer given
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("enquiries_status_idx").on(t.status)]);

// ---------- finance ----------
export const invoices = pgTable("invoices", {
  id: id(),
  number: text("number").notNull().unique(),
  applicationId: text("application_id").notNull().references(() => applications.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  status: invoiceStatus("status").notNull().default("ISSUED"),
  sentAt: timestamp("sent_at", { withTimezone: true }), // last time Finance sent it to the client
  createdById: text("created_by_id").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [index("invoices_application_idx").on(t.applicationId)]);

export const payments = pgTable("payments", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethod("method").notNull(),
  reference: text("reference").notNull().unique(), // bank / mobile money reference: blocks duplicates
  receiptNumber: text("receipt_number").notNull().unique(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  note: text("note"),
  loanFunded: boolean("loan_funded").notNull().default(false),
  loanProvider: text("loan_provider"),
  receiptSentAt: timestamp("receipt_sent_at", { withTimezone: true }),
  recordedById: text("recorded_by_id").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [index("payments_invoice_idx").on(t.invoiceId)]);

// Service fees: Finance/Admin set them per service, optionally narrowed to a country, job, university,
// program or visa purpose. The most specific active rule is offered when a fee plan is applied to an application.
export const feeRules = pgTable("fee_rules", {
  id: id(),
  name: text("name").notNull(),
  service: serviceType("service").notNull(),
  countryId: text("country_id").references(() => countries.id),
  jobId: text("job_id").references(() => jobs.id),
  universityId: text("university_id").references(() => universities.id),
  programId: text("program_id").references(() => programs.id),
  visaCategoryId: text("visa_category_id").references(() => visaCategories.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  installments: jsonb("installments").notNull(), // [{ label, percent, dueDays, stage? }]
  active: boolean("active").notNull().default(true),
  createdById: text("created_by_id").notNull().references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("fee_rules_service_idx").on(t.service, t.active)]);

// Refunds work in two steps: the client asks, Finance/Admin approve the request, then the client fills in
// the refund form (how to be paid) and Finance pays or declines it.
export const refundStatus = pgEnum("refund_status", ["REQUESTED", "FORM_OPEN", "FORM_SUBMITTED", "PAID", "DECLINED"]);
export const refundRequests = pgTable("refund_requests", {
  id: id(),
  reference: text("reference").notNull().unique(), // RF-2026-0001
  applicationId: text("application_id").notNull().references(() => applications.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  clientId: text("client_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: refundStatus("status").notNull().default("REQUESTED"), // legacy two-step status, kept for old rows
  state: text("state").notNull().default("SUBMITTED"), // SUBMITTED → CONSULTANT_REVIEW → FINANCE_REVIEW → ADMIN_APPROVAL → APPROVED → PROCESSING → COMPLETED, or REJECTED
  kind: text("kind").notNull().default("REFUND"), // REFUND | REAPPLICATION
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }),
  paymentReference: text("payment_reference"),
  declarationName: text("declaration_name"), // typed signature
  source: text("source").notNull().default("ONLINE"), // ONLINE | PAPER (scanned form uploaded by staff)
  formKey: text("form_key"), formName: text("form_name"), // uploaded paper form or supporting document
  consultantNote: text("consultant_note"), consultantReviewedById: text("consultant_reviewed_by_id").references(() => users.id),
  financeNote: text("finance_note"), amountApproved: numeric("amount_approved", { precision: 12, scale: 2 }), financeReviewedById: text("finance_reviewed_by_id").references(() => users.id),
  adminNote: text("admin_note"), adminDecidedById: text("admin_decided_by_id").references(() => users.id),
  reapplyMode: text("reapply_mode"), // CONTINUE | NEW, decided when a reapplication is approved
  createdById: text("created_by_id").references(() => users.id),
  decisionNote: text("decision_note"),
  decidedById: text("decided_by_id").references(() => users.id),
  // refund form (step 2)
  amountRequested: numeric("amount_requested", { precision: 12, scale: 2 }),
  currency: text("currency"),
  payoutMethod: paymentMethod("payout_method"),
  accountName: text("account_name"),
  accountDetails: text("account_details"), // bank name and account, or mobile money number
  formSubmittedAt: timestamp("form_submitted_at", { withTimezone: true }),
  // payout
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }),
  paidReference: text("paid_reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  processedById: text("processed_by_id").references(() => users.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("refunds_application_idx").on(t.applicationId), index("refunds_status_idx").on(t.status)]);

// A client asks to change something about their application; the consultant or an admin decides.
export const amendmentStatus = pgEnum("amendment_status", ["REQUESTED", "APPROVED", "DECLINED"]);
export const amendmentRequests = pgTable("amendment_requests", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id),
  clientId: text("client_id").notNull().references(() => users.id),
  kind: text("kind").notNull(), // CHANGE_LISTING | CHANGE_DETAILS | CHANGE_DATES | OTHER
  details: text("details").notNull(),
  status: amendmentStatus("status").notNull().default("REQUESTED"),
  // Formal amendments created by staff (source STAFF) go through approval and client signature.
  source: text("source").notNull().default("CLIENT"), // CLIENT (change request) | STAFF (formal amendment)
  state: text("state"), // STAFF only: PENDING_APPROVAL → AWAITING_SIGNATURE → SIGNED, or REJECTED
  reason: text("reason"),
  contractId: text("contract_id"), // the agreement being amended
  newFeeAmount: numeric("new_fee_amount", { precision: 12, scale: 2 }),
  attachmentKey: text("attachment_key"), attachmentName: text("attachment_name"),
  createdById: text("created_by_id").references(() => users.id),
  approvedById: text("approved_by_id").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  signedContractId: text("signed_contract_id"),
  decisionNote: text("decision_note"),
  decidedById: text("decided_by_id").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("amendments_application_idx").on(t.applicationId)]);

// ---------- upgrade: permissions, assignments, settings, contracts, appointments, payments, messaging ----------

// Which services (WORK, STUDY, VISA, FLIGHT) each consultant may handle. No row = no access.
export const consultantServices = pgTable("consultant_services", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  service: text("service").notNull(),
  grantedById: text("granted_by_id").references(() => users.id),
  createdAt: created(),
}, (t) => [uniqueIndex("consultant_services_unique").on(t.userId, t.service)]);

// A consultant asks to serve an unassigned application; an admin approves or rejects.
export const assignmentRequests = pgTable("assignment_requests", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  consultantId: text("consultant_id").notNull().references(() => users.id),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED | WITHDRAWN
  note: text("note"),
  decidedById: text("decided_by_id").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("assignment_requests_app_idx").on(t.applicationId), index("assignment_requests_status_idx").on(t.status)]);

// Every change of consultant on an application.
export const assignmentHistory = pgTable("assignment_history", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  fromConsultantId: text("from_consultant_id").references(() => users.id),
  toConsultantId: text("to_consultant_id").references(() => users.id),
  kind: text("kind").notNull(), // ASSIGNED | REASSIGNED | UNASSIGNED | REQUEST_APPROVED
  reason: text("reason"),
  changedById: text("changed_by_id").references(() => users.id),
  createdAt: created(),
}, (t) => [index("assignment_history_app_idx").on(t.applicationId)]);

// Account activation and password links. Only a hash of the token is stored.
export const accountTokens = pgTable("account_tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull(), // ACTIVATE
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: created(),
});

// Company settings edited by admins: office details, refund policies per service.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: text("updated_by_id").references(() => users.id),
  updatedAt: updated(),
});

// Contract wording per service. Editing creates a new version; signed contracts keep the text they were shown.
export const contractTemplates = pgTable("contract_templates", {
  id: id(),
  service: text("service").notNull(), // WORK | STUDY | VISA
  version: integer("version").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: created(),
}, (t) => [uniqueIndex("contract_templates_version").on(t.service, t.version)]);

// Signed agreements and amendments: online (typed signature) or uploaded scans of paper copies.
export const contracts = pgTable("contracts", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("CONTRACT"), // CONTRACT | AMENDMENT
  method: text("method").notNull(), // ONLINE | UPLOADED
  templateId: text("template_id").references(() => contractTemplates.id),
  version: integer("version"),
  title: text("title").notNull(),
  body: text("body"), // exact text the client signed (online)
  signedName: text("signed_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
  signedById: text("signed_by_id").references(() => users.id), // the client (online)
  signedIp: text("signed_ip"),
  signedUserAgent: text("signed_user_agent"),
  storageKey: text("storage_key").notNull(), // PDF (generated or uploaded scan)
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedById: text("uploaded_by_id").references(() => users.id),
  amendmentId: text("amendment_id"),
  supersedesId: text("supersedes_id"),
  createdAt: created(),
}, (t) => [index("contracts_application_idx").on(t.applicationId)]);

// Office visit invitations from consultants.
export const appointments = pgTable("appointments", {
  id: id(),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  consultantId: text("consultant_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  expectedStage: text("expected_stage"),
  remoteAllowed: boolean("remote_allowed").notNull().default(false),
  office: jsonb("office").notNull(), // address, maps link and phone at the time of the invitation
  status: text("status").notNull().default("PENDING"), // PENDING | ACCEPTED | DECLINED | REMOTE | COMPLETED
  clientNote: text("client_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("appointments_application_idx").on(t.applicationId)]);

// Payments reported by clients (with proof) or prepared by Finance, waiting for Finance approval.
export const paymentSubmissions = pgTable("payment_submissions", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  applicationId: text("application_id").notNull().references(() => applications.id),
  submittedById: text("submitted_by_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethod("method").notNull(),
  reference: text("reference").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  proofKey: text("proof_key"), proofName: text("proof_name"), proofMime: text("proof_mime"),
  loanFunded: boolean("loan_funded").notNull().default(false),
  loanProvider: text("loan_provider"),
  loanDocKey: text("loan_doc_key"), loanDocName: text("loan_doc_name"),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
  clientNote: text("client_note"),
  internalNote: text("internal_note"),
  rejectionReason: text("rejection_reason"),
  reviewedById: text("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  paymentId: text("payment_id").references(() => payments.id),
  createdAt: created(),
}, (t) => [index("payment_submissions_status_idx").on(t.status), index("payment_submissions_invoice_idx").on(t.invoiceId)]);

// Staff conversations: direct messages, groups, application threads and Finance/Admin-only rooms.
export const conversations = pgTable("conversations", {
  id: id(),
  kind: text("kind").notNull(), // DIRECT | GROUP | APPLICATION
  title: text("title"),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
  financePrivate: boolean("finance_private").notNull().default(false), // only Finance and Admin, ever
  createdById: text("created_by_id").notNull().references(() => users.id),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: created(),
}, (t) => [index("conversations_application_idx").on(t.applicationId)]);

export const conversationMembers = pgTable("conversation_members", {
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("conversation_members_unique").on(t.conversationId, t.userId)]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  mentions: jsonb("mentions"), // user ids mentioned
  createdAt: created(),
}, (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)]);

// ---------- activity and notifications ----------
export const activities = pgTable("activities", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(), // application.submitted, document.requested, payment.recorded, ...
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }),
  summary: text("summary").notNull(),
  changes: jsonb("changes"),
  createdAt: created(),
}, (t) => [index("activities_application_idx").on(t.applicationId), index("activities_created_idx").on(t.createdAt)]);

export const notifications = pgTable("notifications", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // a person...
  role: role("role"), // ...or a whole department
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.readAt), index("notifications_role_idx").on(t.role, t.readAt)]);

// Every email the system tries to send. SKIPPED means email is not connected yet (no RESEND_API_KEY).
export const emailStatus = pgEnum("email_status", ["SENT", "FAILED", "SKIPPED"]);
export const emailLog = pgTable("email_log", {
  id: id(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: emailStatus("status").notNull(),
  error: text("error"),
  createdAt: created(),
}, (t) => [index("email_log_created_idx").on(t.createdAt)]);

// ---------- website content ----------
export const promotions = pgTable("promotions", {
  id: id(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  ctaLabel: text("cta_label").notNull(),
  ctaUrl: text("cta_url").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: publishStatus("status").notNull().default("DRAFT"),
  createdAt: created(),
});

export const portfolioEntries = pgTable("portfolio_entries", {
  id: id(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  year: integer("year"),
  status: publishStatus("status").notNull().default("DRAFT"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const testimonials = pgTable("testimonials", {
  id: id(),
  clientName: text("client_name").notNull(),
  service: serviceType("service").notNull(),
  quote: text("quote").notNull(),
  consentGiven: boolean("consent_given").notNull().default(false),
  status: publishStatus("status").notNull().default("DRAFT"),
  createdAt: created(),
});

export const newsPosts = pgTable("news_posts", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  status: publishStatus("status").notNull().default("DRAFT"),
});

export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: id(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  number: text("number").notNull(), // international digits only, e.g. 250792881863
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Running counters for readable references (FF-WA-2026-0001, INV-2026-0001, RC-2026-0001).
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
}, (t) => [uniqueIndex("counters_key_idx").on(t.key)]);

// ---------- relations (for typed nested queries) ----------
export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications, { relationName: "client" }),
  assigned: many(applications, { relationName: "consultant" }),
}));
export const continentsRelations = relations(continents, ({ many }) => ({ countries: many(countries) }));
export const countriesRelations = relations(countries, ({ one, many }) => ({
  continent: one(continents, { fields: [countries.continentId], references: [continents.id] }),
  jobs: many(jobs),
  universities: many(universities),
}));
export const jobCategoriesRelations = relations(jobCategories, ({ many }) => ({ jobs: many(jobs) }));
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  country: one(countries, { fields: [jobs.countryId], references: [countries.id] }),
  category: one(jobCategories, { fields: [jobs.categoryId], references: [jobCategories.id] }),
  requirements: many(requirementItems),
}));
export const universitiesRelations = relations(universities, ({ one, many }) => ({
  country: one(countries, { fields: [universities.countryId], references: [countries.id] }),
  programs: many(programs),
}));
export const programsRelations = relations(programs, ({ one, many }) => ({
  university: one(universities, { fields: [programs.universityId], references: [universities.id] }),
  requirements: many(requirementItems),
}));
export const visaCategoriesRelations = relations(visaCategories, ({ many }) => ({ guidance: many(visaGuidance) }));
export const visaGuidanceRelations = relations(visaGuidance, ({ one, many }) => ({
  category: one(visaCategories, { fields: [visaGuidance.categoryId], references: [visaCategories.id] }),
  requirements: many(requirementItems),
}));
export const requirementItemsRelations = relations(requirementItems, ({ one }) => ({
  job: one(jobs, { fields: [requirementItems.jobId], references: [jobs.id] }),
  program: one(programs, { fields: [requirementItems.programId], references: [programs.id] }),
  visaGuidance: one(visaGuidance, { fields: [requirementItems.visaGuidanceId], references: [visaGuidance.id] }),
}));
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  client: one(users, { fields: [applications.clientId], references: [users.id], relationName: "client" }),
  consultant: one(users, { fields: [applications.consultantId], references: [users.id], relationName: "consultant" }),
  job: one(jobs, { fields: [applications.jobId], references: [jobs.id] }),
  program: one(programs, { fields: [applications.programId], references: [programs.id] }),
  visaGuidance: one(visaGuidance, { fields: [applications.visaGuidanceId], references: [visaGuidance.id] }),
  checklist: many(checklistItems),
  documents: many(documents),
  updates: many(applicationUpdates),
  invoices: many(invoices),
  refunds: many(refundRequests),
  amendments: many(amendmentRequests),
  contracts: many(contracts),
  appointments: many(appointments),
  assignmentRequests: many(assignmentRequests),
  paymentSubmissions: many(paymentSubmissions),
}));
export const checklistItemsRelations = relations(checklistItems, ({ one, many }) => ({
  application: one(applications, { fields: [checklistItems.applicationId], references: [applications.id] }),
  reviewedBy: one(users, { fields: [checklistItems.reviewedById], references: [users.id] }),
  documents: many(documents),
}));
export const documentsRelations = relations(documents, ({ one }) => ({
  application: one(applications, { fields: [documents.applicationId], references: [applications.id] }),
  checklistItem: one(checklistItems, { fields: [documents.checklistItemId], references: [checklistItems.id] }),
}));
export const applicationUpdatesRelations = relations(applicationUpdates, ({ one }) => ({
  application: one(applications, { fields: [applicationUpdates.applicationId], references: [applications.id] }),
  author: one(users, { fields: [applicationUpdates.authorId], references: [users.id] }),
}));
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  application: one(applications, { fields: [invoices.applicationId], references: [applications.id] }),
  payments: many(payments),
}));
export const refundRequestsRelations = relations(refundRequests, ({ one }) => ({
  application: one(applications, { fields: [refundRequests.applicationId], references: [applications.id] }),
  invoice: one(invoices, { fields: [refundRequests.invoiceId], references: [invoices.id] }),
  client: one(users, { fields: [refundRequests.clientId], references: [users.id] }),
}));
export const amendmentRequestsRelations = relations(amendmentRequests, ({ one }) => ({
  application: one(applications, { fields: [amendmentRequests.applicationId], references: [applications.id] }),
  client: one(users, { fields: [amendmentRequests.clientId], references: [users.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  recordedBy: one(users, { fields: [payments.recordedById], references: [users.id] }),
}));
export const enquiriesRelations = relations(enquiries, ({ one }) => ({
  assignedTo: one(users, { fields: [enquiries.assignedToId], references: [users.id] }),
  client: one(users, { fields: [enquiries.clientId], references: [users.id] }),
}));
export const activitiesRelations = relations(activities, ({ one }) => ({
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
  application: one(applications, { fields: [activities.applicationId], references: [applications.id] }),
}));

export const assignmentRequestsRelations = relations(assignmentRequests, ({ one }) => ({
  application: one(applications, { fields: [assignmentRequests.applicationId], references: [applications.id] }),
  consultant: one(users, { fields: [assignmentRequests.consultantId], references: [users.id] }),
}));
export const assignmentHistoryRelations = relations(assignmentHistory, ({ one }) => ({
  from: one(users, { fields: [assignmentHistory.fromConsultantId], references: [users.id], relationName: "history_from" }),
  to: one(users, { fields: [assignmentHistory.toConsultantId], references: [users.id], relationName: "history_to" }),
  changedBy: one(users, { fields: [assignmentHistory.changedById], references: [users.id], relationName: "history_by" }),
  application: one(applications, { fields: [assignmentHistory.applicationId], references: [applications.id] }),
}));
export const contractsRelations = relations(contracts, ({ one }) => ({
  application: one(applications, { fields: [contracts.applicationId], references: [applications.id] }),
  uploadedBy: one(users, { fields: [contracts.uploadedById], references: [users.id] }),
}));
export const appointmentsRelations = relations(appointments, ({ one }) => ({
  application: one(applications, { fields: [appointments.applicationId], references: [applications.id] }),
  consultant: one(users, { fields: [appointments.consultantId], references: [users.id] }),
}));
export const paymentSubmissionsRelations = relations(paymentSubmissions, ({ one }) => ({
  invoice: one(invoices, { fields: [paymentSubmissions.invoiceId], references: [invoices.id] }),
  application: one(applications, { fields: [paymentSubmissions.applicationId], references: [applications.id] }),
  submittedBy: one(users, { fields: [paymentSubmissions.submittedById], references: [users.id], relationName: "submission_by" }),
  reviewedBy: one(users, { fields: [paymentSubmissions.reviewedById], references: [users.id], relationName: "submission_reviewer" }),
}));
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  application: one(applications, { fields: [conversations.applicationId], references: [applications.id] }),
  members: many(conversationMembers),
  messages: many(messages),
}));
export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [conversationMembers.userId], references: [users.id] }),
}));
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  author: one(users, { fields: [messages.authorId], references: [users.id] }),
}));
