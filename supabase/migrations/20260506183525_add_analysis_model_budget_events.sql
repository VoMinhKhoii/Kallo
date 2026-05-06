CREATE TABLE "analysis_model_budget_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"route" text NOT NULL,
	"work_kind" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"request_count" integer DEFAULT 1 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"error_category" text,
	CONSTRAINT "analysis_model_budget_events_work_kind_check" CHECK ("analysis_model_budget_events"."work_kind" IN ('primary', 'shadow', 'nonessential')),
	CONSTRAINT "analysis_model_budget_events_request_count_check" CHECK ("analysis_model_budget_events"."request_count" >= 0),
	CONSTRAINT "analysis_model_budget_events_input_tokens_check" CHECK ("analysis_model_budget_events"."input_tokens" >= 0),
	CONSTRAINT "analysis_model_budget_events_output_tokens_check" CHECK ("analysis_model_budget_events"."output_tokens" >= 0),
	CONSTRAINT "analysis_model_budget_events_error_category_check" CHECK ("analysis_model_budget_events"."error_category" IS NULL OR "analysis_model_budget_events"."error_category" IN ('rate_limit', 'quota', 'server_error', 'timeout', 'network', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX "analysis_model_budget_events_created_idx" ON "analysis_model_budget_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analysis_model_budget_events_work_created_idx" ON "analysis_model_budget_events" USING btree ("work_kind","created_at");--> statement-breakpoint
CREATE INDEX "analysis_model_budget_events_provider_error_idx" ON "analysis_model_budget_events" USING btree ("provider","error_category","created_at");