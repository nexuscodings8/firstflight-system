CREATE TYPE "public"."amendment_status" AS ENUM('REQUESTED', 'APPROVED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('REQUESTED', 'FORM_OPEN', 'FORM_SUBMITTED', 'PAID', 'DECLINED');--> statement-breakpoint
ALTER TYPE "public"."enquiry_type" ADD VALUE 'FLIGHT_BOOKING';--> statement-breakpoint
CREATE TABLE "amendment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"client_id" text NOT NULL,
	"kind" text NOT NULL,
	"details" text NOT NULL,
	"status" "amendment_status" DEFAULT 'REQUESTED' NOT NULL,
	"decision_note" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"service" "service_type" NOT NULL,
	"country_id" text,
	"job_id" text,
	"university_id" text,
	"program_id" text,
	"visa_category_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"installments" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"application_id" text NOT NULL,
	"invoice_id" text,
	"client_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'REQUESTED' NOT NULL,
	"decision_note" text,
	"decided_by_id" text,
	"amount_requested" numeric(12, 2),
	"currency" text,
	"payout_method" "payment_method",
	"account_name" text,
	"account_details" text,
	"form_submitted_at" timestamp with time zone,
	"paid_amount" numeric(12, 2),
	"paid_reference" text,
	"paid_at" timestamp with time zone,
	"processed_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_requests_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "fee_plan" jsonb;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_visa_category_id_visa_categories_id_fk" FOREIGN KEY ("visa_category_id") REFERENCES "public"."visa_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amendments_application_idx" ON "amendment_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "fee_rules_service_idx" ON "fee_rules" USING btree ("service","active");--> statement-breakpoint
CREATE INDEX "refunds_application_idx" ON "refund_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refund_requests" USING btree ("status");