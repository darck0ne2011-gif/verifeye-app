CREATE TABLE "scan_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fake_probability" integer,
	"ai_probability" integer,
	"metadata" jsonb,
	"ai_signatures" jsonb,
	"scanned_models" jsonb,
	"expert_summaries" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"score" integer NOT NULL,
	"status" text NOT NULL,
	"file_hash" text,
	"model_scores" jsonb,
	"ai_signatures" jsonb,
	"scanned_models" jsonb,
	"metadata" jsonb,
	"media_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"subscription_tier" text DEFAULT 'starter' NOT NULL,
	"scan_credits" integer DEFAULT 3 NOT NULL,
	"apple_sub" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub")
);
--> statement-breakpoint
ALTER TABLE "scan_history" ADD CONSTRAINT "scan_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_history_user_id_idx" ON "scan_history" USING btree ("user_id");