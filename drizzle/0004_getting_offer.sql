ALTER TYPE "public"."payment_method" ADD VALUE 'LOAN';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'GETTING_OFFER' BEFORE 'FINAL_COLLECTION';--> statement-breakpoint
ALTER TYPE "public"."stage" ADD VALUE 'VISA_PROCESSING' BEFORE 'FINAL_COLLECTION';--> statement-breakpoint
CREATE TABLE "case_files" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"issued_on" timestamp with time zone,
	"historical" boolean DEFAULT false NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"client_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"evidence_file_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"decision_note" text,
	"created_by_id" text NOT NULL,
	"validated_by_id" text,
	"validated_at" timestamp with time zone,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"application_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"installment_index" integer NOT NULL,
	"client_id" text NOT NULL,
	"provider" text NOT NULL,
	"amount_requested" numeric(12, 2) NOT NULL,
	"details" text NOT NULL,
	"doc_key" text,
	"doc_name" text,
	"doc_mime" text,
	"status" text DEFAULT 'PENDING_REVIEW' NOT NULL,
	"approved_amount" numeric(12, 2),
	"approved_provider" text,
	"conditions" text,
	"internal_note" text,
	"decision_note" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_requests_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "origin" text DEFAULT 'ONLINE' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "original_start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "imported_stage_reached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "import_note" text;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "following" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "historical" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_payments" ADD CONSTRAINT "historical_payments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_payments" ADD CONSTRAINT "historical_payments_evidence_file_id_case_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."case_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_payments" ADD CONSTRAINT "historical_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_payments" ADD CONSTRAINT "historical_payments_validated_by_id_users_id_fk" FOREIGN KEY ("validated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_payments" ADD CONSTRAINT "historical_payments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_files_app_idx" ON "case_files" USING btree ("application_id","kind");--> statement-breakpoint
CREATE INDEX "historical_payments_app_idx" ON "historical_payments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "loan_requests_app_idx" ON "loan_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "loan_requests_status_idx" ON "loan_requests" USING btree ("status");--> statement-breakpoint
-- Members of existing direct and group conversations keep getting notified of new messages.
UPDATE "conversation_members" SET "following" = true WHERE "conversation_id" IN (SELECT "id" FROM "conversations" WHERE "kind" IN ('DIRECT', 'GROUP'));
