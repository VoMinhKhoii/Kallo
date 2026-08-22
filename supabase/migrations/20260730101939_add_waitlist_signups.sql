CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"source" text,
	"confirmation_token_hash" text,
	"confirmation_sent_at" timestamp with time zone,
	"confirmation_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_signups_locale_check" CHECK ("waitlist_signups"."locale" IN ('en', 'vi'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_email_key" ON "waitlist_signups" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_token_key" ON "waitlist_signups" USING btree ("confirmation_token_hash");--> statement-breakpoint
CREATE INDEX "waitlist_signups_ip_created_idx" ON "waitlist_signups" USING btree ("ip_hash","created_at" DESC);