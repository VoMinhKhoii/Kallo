CREATE TABLE "product_telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_id" uuid NOT NULL,
	"schema_version" smallint NOT NULL,
	"event_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"platform" text NOT NULL,
	"app_version" text,
	"anonymous_id" text,
	"session_id" text,
	"consent" boolean NOT NULL,
	"locale" text,
	"pipeline_request_id" uuid,
	"meal_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_telemetry_events_event_id_key" UNIQUE("event_id"),
	CONSTRAINT "product_telemetry_events_identity_check" CHECK ("product_telemetry_events"."user_id" IS NOT NULL OR ("product_telemetry_events"."anonymous_id" IS NOT NULL AND "product_telemetry_events"."consent" = true)),
	CONSTRAINT "product_telemetry_events_schema_version_check" CHECK ("product_telemetry_events"."schema_version" = 1),
	CONSTRAINT "product_telemetry_events_name_check" CHECK ("product_telemetry_events"."event_name" IN ('app_opened', 'screen_viewed', 'signup_started', 'signup_completed', 'meal_analysis_started', 'meal_analysis_completed', 'meal_analysis_failed', 'meal_saved', 'meal_discarded', 'meal_edited', 'onboarding_step_viewed', 'onboarding_step_completed', 'onboarding_completed', 'feature_viewed', 'feature_used', 'feature_adopted', 'feedback_submitted', 'api_request_failed', 'app_crashed', 'performance_measured', 'health_check_failed')),
	CONSTRAINT "product_telemetry_events_platform_check" CHECK ("product_telemetry_events"."platform" IN ('web', 'ios', 'android'))
);
--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "pipeline_request_id" uuid;--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD COLUMN "pipeline_request_id" uuid;--> statement-breakpoint
ALTER TABLE "product_telemetry_events" ADD CONSTRAINT "product_telemetry_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_telemetry_events" ADD CONSTRAINT "product_telemetry_events_pipeline_request_id_pipeline_requests_id_fk" FOREIGN KEY ("pipeline_request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_telemetry_events" ADD CONSTRAINT "product_telemetry_events_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_telemetry_events_occurred_at_idx" ON "product_telemetry_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "product_telemetry_events_name_occurred_at_idx" ON "product_telemetry_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_pipeline_request_id_pipeline_requests_id_fk" FOREIGN KEY ("pipeline_request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD CONSTRAINT "pending_analyses_pipeline_request_id_pipeline_requests_id_fk" FOREIGN KEY ("pipeline_request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Domain B failure-boundary exception permitted by docs/DATABASE.md: this
-- newly created table is server-only, so make it unreachable to Supabase
-- client roles in the same migration that creates it. Any future policies,
-- functions, or triggers belong in a separate manual migration.
ALTER TABLE "product_telemetry_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "product_telemetry_events" FROM anon, authenticated;
