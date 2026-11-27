CREATE TABLE "account_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"consultant_id" text NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expected_stage" text,
	"remote_allowed" boolean DEFAULT false NOT NULL,
	"office" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"client_note" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"from_consultant_id" text,
	"to_consultant_id" text,
	"kind" text NOT NULL,
	"reason" text,
	"changed_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"consultant_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultant_services" (
	"user_id" text NOT NULL,
	"service" text NOT NULL,
	"granted_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"kind" text DEFAULT 'CONTRACT' NOT NULL,
	"method" text NOT NULL,
	"template_id" text,
	"version" integer,
	"title" text NOT NULL,
	"body" text,
	"signed_name" text,
	"signed_at" timestamp with time zone NOT NULL,
	"signed_by_id" text,
	"signed_ip" text,
	"signed_user_agent" text,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by_id" text,
	"amendment_id" text,
	"supersedes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"application_id" text,
	"finance_private" boolean DEFAULT false NOT NULL,
	"created_by_id" text NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"mentions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"application_id" text NOT NULL,
	"submitted_by_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"proof_key" text,
	"proof_name" text,
	"proof_mime" text,
	"loan_funded" boolean DEFAULT false NOT NULL,
	"loan_provider" text,
	"loan_doc_key" text,
	"loan_doc_name" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"client_note" text,
	"internal_note" text,
	"rejection_reason" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "source" text DEFAULT 'CLIENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "contract_id" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "new_fee_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "attachment_key" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "attachment_name" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "approved_by_id" text;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD COLUMN "signed_contract_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "fee_plan_history" jsonb;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "previous_application_id" text;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "reviewed_by_id" text;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "loan_funded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "loan_provider" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "state" text DEFAULT 'SUBMITTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "kind" text DEFAULT 'REFUND' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "amount_paid" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "declaration_name" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "source" text DEFAULT 'ONLINE' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "form_key" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "form_name" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "consultant_note" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "consultant_reviewed_by_id" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "finance_note" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "amount_approved" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "finance_reviewed_by_id" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "admin_decided_by_id" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "reapply_mode" text;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_from_consultant_id_users_id_fk" FOREIGN KEY ("from_consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_to_consultant_id_users_id_fk" FOREIGN KEY ("to_consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_requests" ADD CONSTRAINT "assignment_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_requests" ADD CONSTRAINT "assignment_requests_consultant_id_users_id_fk" FOREIGN KEY ("consultant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_requests" ADD CONSTRAINT "assignment_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_services" ADD CONSTRAINT "consultant_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_services" ADD CONSTRAINT "consultant_services_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_by_id_users_id_fk" FOREIGN KEY ("signed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_application_idx" ON "appointments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "assignment_history_app_idx" ON "assignment_history" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "assignment_requests_app_idx" ON "assignment_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "assignment_requests_status_idx" ON "assignment_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "consultant_services_unique" ON "consultant_services" USING btree ("user_id","service");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_templates_version" ON "contract_templates" USING btree ("service","version");--> statement-breakpoint
CREATE INDEX "contracts_application_idx" ON "contracts" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_members_unique" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversations_application_idx" ON "conversations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_submissions_status_idx" ON "payment_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_submissions_invoice_idx" ON "payment_submissions" USING btree ("invoice_id");--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendment_requests" ADD CONSTRAINT "amendment_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_consultant_reviewed_by_id_users_id_fk" FOREIGN KEY ("consultant_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_finance_reviewed_by_id_users_id_fk" FOREIGN KEY ("finance_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_admin_decided_by_id_users_id_fk" FOREIGN KEY ("admin_decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing refunds move to the new multi-step states.
UPDATE "refund_requests" SET "state" = CASE "status"::text WHEN 'REQUESTED' THEN 'SUBMITTED' WHEN 'FORM_OPEN' THEN 'FINANCE_REVIEW' WHEN 'FORM_SUBMITTED' THEN 'ADMIN_APPROVAL' WHEN 'PAID' THEN 'COMPLETED' WHEN 'DECLINED' THEN 'REJECTED' ELSE 'SUBMITTED' END, "amount_paid" = "amount_requested";--> statement-breakpoint
-- Existing consultants keep access to every service, so nothing they do today stops working.
INSERT INTO "consultant_services" ("user_id", "service") SELECT u."id", s.svc FROM "users" u CROSS JOIN (VALUES ('WORK'), ('STUDY'), ('VISA'), ('FLIGHT')) AS s(svc) WHERE u."role" = 'CONSULTANT' ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Current assignments become the first line of each application's assignment history.
INSERT INTO "assignment_history" ("id", "application_id", "to_consultant_id", "kind", "reason", "created_at") SELECT gen_random_uuid()::text, a."id", a."consultant_id", 'ASSIGNED', 'Assigned before assignment history was recorded', a."created_at" FROM "applications" a WHERE a."consultant_id" IS NOT NULL;
