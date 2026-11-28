CREATE TABLE "visa_estimates" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"expected_date" text NOT NULL,
	"expected_time" text,
	"note" text,
	"set_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_collection_mode" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "final_collection_chosen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "correction_note" text;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "replaces_id" text;--> statement-breakpoint
ALTER TABLE "case_files" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "application_id" text;--> statement-breakpoint
ALTER TABLE "visa_estimates" ADD CONSTRAINT "visa_estimates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_estimates" ADD CONSTRAINT "visa_estimates_set_by_id_users_id_fk" FOREIGN KEY ("set_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visa_estimates_app_idx" ON "visa_estimates" USING btree ("application_id","created_at");--> statement-breakpoint
-- Applications already completed: use the last update as the completion date (Admin can correct it).
UPDATE "applications" SET "completed_at" = "updated_at" WHERE "status" = 'COMPLETED' AND "completed_at" IS NULL;
--> statement-breakpoint
-- Link existing notifications to their application where the link names one.
UPDATE "notifications" SET "application_id" = substring("link" from '/applications/([^/#?]+)') WHERE "application_id" IS NULL AND "link" ~ '/applications/[^/#?]+';
