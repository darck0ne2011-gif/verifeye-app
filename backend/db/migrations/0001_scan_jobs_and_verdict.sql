CREATE TABLE "scan_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"media_category" text NOT NULL,
	"source" text DEFAULT 'file' NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"file_hash" text,
	"models" jsonb NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scan_cache" ADD COLUMN "media_category" text;--> statement-breakpoint
ALTER TABLE "scan_history" ADD COLUMN "verdict" text;--> statement-breakpoint
ALTER TABLE "scan_history" ADD COLUMN "confidence" integer;--> statement-breakpoint
ALTER TABLE "scan_history" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_jobs_status_idx" ON "scan_jobs" USING btree ("status","created_at");