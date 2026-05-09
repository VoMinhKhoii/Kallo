CREATE TABLE "analysis_guard_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id_hash" text,
	"ip_hash" text,
	"route" text NOT NULL,
	"reason" text NOT NULL,
	"retry_after_seconds" integer
);
--> statement-breakpoint
CREATE INDEX "analysis_guard_events_reason_created_idx" ON "analysis_guard_events" USING btree ("reason","created_at");--> statement-breakpoint
CREATE INDEX "analysis_guard_events_user_created_idx" ON "analysis_guard_events" USING btree ("user_id_hash","created_at");