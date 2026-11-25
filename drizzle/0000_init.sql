CREATE TYPE "public"."application_status" AS ENUM('ACTIVE', 'COMPLETED', 'NOT_ELIGIBLE', 'UNSUCCESSFUL', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('OPEN', 'CLOSING_SOON', 'CLOSED', 'FILLED');--> statement-breakpoint
CREATE TYPE "public"."billing_period" AS ENUM('YEAR', 'SEMESTER', 'TERM', 'MONTH', 'FULL_PROGRAM');--> statement-breakpoint
CREATE TYPE "public"."checklist_state" AS ENUM('PENDING', 'REQUESTED', 'UPLOADED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL', 'TEMPORARY');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('NEW', 'IN_PROGRESS', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."enquiry_type" AS ENUM('PROGRAM_GUIDANCE', 'VISA_CONSULTATION', 'JOB_QUESTION', 'GENERAL', 'CHATBOT_HANDOFF');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."pay_period" AS ENUM('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."review_state" AS ENUM('CURRENT', 'NEEDS_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CLIENT', 'CONSULTANT', 'FINANCE', 'ADMIN', 'CONTENT_MANAGER');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('WORK', 'STUDY', 'VISA');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('SUBMITTED', 'ELIGIBILITY_REVIEW', 'INITIAL_PAYMENT', 'DOCUMENT_SIGNING', 'PROCESSING', 'FINAL_COLLECTION', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."study_level" AS ENUM('FOUNDATION', 'CERTIFICATE', 'DIPLOMA', 'BACHELOR', 'MASTER', 'PHD', 'LANGUAGE');--> statement-breakpoint
CREATE TYPE "public"."update_visibility" AS ENUM('CLIENT', 'INTERNAL');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"application_id" text,
	"summary" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"visibility" "update_visibility" DEFAULT 'CLIENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"service" "service_type" NOT NULL,
	"client_id" text NOT NULL,
	"consultant_id" text,
	"job_id" text,
	"program_id" text,
	"visa_guidance_id" text,
	"selection" jsonb NOT NULL,
	"client_note" text,
	"stage" "stage" DEFAULT 'SUBMITTED' NOT NULL,
	"status" "application_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"label" text NOT NULL,
	"mandatory" boolean DEFAULT true NOT NULL,
	"state" "checklist_state" DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"requested_by_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "continents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "continents_name_unique" UNIQUE("name"),
	CONSTRAINT "continents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iso_code" text NOT NULL,
	"slug" text NOT NULL,
	"continent_id" text,
	"work_destination" boolean DEFAULT false NOT NULL,
	"study_destination" boolean DEFAULT false NOT NULL,
	"blurb" text,
	"status" "publish_status" DEFAULT 'PUBLISHED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "countries_iso_code_unique" UNIQUE("iso_code"),
	CONSTRAINT "countries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"checklist_item_id" text,
	"uploaded_by_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"type" "enquiry_type" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"context" jsonb,
	"client_id" text,
	"assigned_to_id" text,
	"status" "enquiry_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"application_id" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'ISSUED' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "job_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "job_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "job_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"country_id" text NOT NULL,
	"location" text NOT NULL,
	"category_id" text NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"eligibility" text NOT NULL,
	"benefits" text NOT NULL,
	"salary_min" numeric(12, 2),
	"salary_max" numeric(12, 2),
	"salary_currency" text DEFAULT 'USD' NOT NULL,
	"salary_period" "pay_period" DEFAULT 'MONTH' NOT NULL,
	"deadline" timestamp with time zone,
	"availability" "availability" DEFAULT 'OPEN' NOT NULL,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	CONSTRAINT "news_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"role" "role",
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text NOT NULL,
	"receipt_number" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"recorded_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference"),
	CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "portfolio_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"year" integer,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"university_id" text NOT NULL,
	"name" text NOT NULL,
	"level" "study_level" NOT NULL,
	"intakes" text[] DEFAULT '{}'::text[] NOT NULL,
	"duration" text NOT NULL,
	"admission" text NOT NULL,
	"language" text NOT NULL,
	"tuition_amount" numeric(12, 2),
	"tuition_currency" text DEFAULT 'USD' NOT NULL,
	"billing_period" "billing_period" DEFAULT 'YEAR' NOT NULL,
	"deadline" timestamp with time zone,
	"availability" "availability" DEFAULT 'OPEN' NOT NULL,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"cta_label" text NOT NULL,
	"cta_url" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_items" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"mandatory" boolean DEFAULT true NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"job_id" text,
	"program_id" text,
	"visa_guidance_id" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" text PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"service" "service_type" NOT NULL,
	"quote" text NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_id" text NOT NULL,
	"city" text NOT NULL,
	"website" text,
	"description" text NOT NULL,
	"status" "publish_status" DEFAULT 'PUBLISHED' NOT NULL,
	CONSTRAINT "universities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'CLIENT' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visa_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "visa_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "visa_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "visa_guidance" (
	"id" text PRIMARY KEY NOT NULL,
	"destination_iso" text NOT NULL,
	"destination_city" text,
	"category_id" text NOT NULL,
	"nationality_iso" text,
	"residence_iso" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"processing_time" text,
	"fee_note" text,
	"local_guidance" text,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"review_state" "review_state" DEFAULT 'CURRENT' NOT NULL,
	"status" "publish_status" DEFAULT 'DRAFT' NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"number" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_updates" ADD CONSTRAINT "application_updates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_updates" ADD CONSTRAINT "application_updates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_visa_guidance_id_visa_guidance_id_fk" FOREIGN KEY ("visa_guidance_id") REFERENCES "public"."visa_guidance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_continent_id_continents_id_fk" FOREIGN KEY ("continent_id") REFERENCES "public"."continents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_job_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."job_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_items" ADD CONSTRAINT "requirement_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_items" ADD CONSTRAINT "requirement_items_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_items" ADD CONSTRAINT "requirement_items_visa_guidance_id_visa_guidance_id_fk" FOREIGN KEY ("visa_guidance_id") REFERENCES "public"."visa_guidance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universities" ADD CONSTRAINT "universities_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_guidance" ADD CONSTRAINT "visa_guidance_category_id_visa_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."visa_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_guidance" ADD CONSTRAINT "visa_guidance_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_application_idx" ON "activities" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "activities_created_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "updates_application_idx" ON "application_updates" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "applications_client_idx" ON "applications" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "applications_consultant_idx" ON "applications" USING btree ("consultant_id");--> statement-breakpoint
CREATE INDEX "applications_status_stage_idx" ON "applications" USING btree ("status","stage");--> statement-breakpoint
CREATE INDEX "checklist_application_idx" ON "checklist_items" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counters_key_idx" ON "counters" USING btree ("key");--> statement-breakpoint
CREATE INDEX "documents_application_idx" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_application_idx" ON "invoices" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "jobs_country_status_idx" ON "jobs" USING btree ("country_id","status");--> statement-breakpoint
CREATE INDEX "jobs_category_idx" ON "jobs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_role_idx" ON "notifications" USING btree ("role","read_at");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "programs_university_status_idx" ON "programs" USING btree ("university_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "universities_country_idx" ON "universities" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "visa_guidance_lookup_idx" ON "visa_guidance" USING btree ("destination_iso","category_id","status");