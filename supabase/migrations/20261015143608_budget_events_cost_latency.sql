ALTER TABLE "analysis_model_budget_events" ADD COLUMN "cache_write_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD COLUMN "cost_usd" numeric(12, 8);--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD COLUMN "fallback_from" text;--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD CONSTRAINT "analysis_model_budget_events_cache_write_tokens_check" CHECK ("analysis_model_budget_events"."cache_write_tokens" >= 0);--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD CONSTRAINT "analysis_model_budget_events_cost_usd_check" CHECK ("analysis_model_budget_events"."cost_usd" IS NULL OR "analysis_model_budget_events"."cost_usd" >= 0);--> statement-breakpoint
ALTER TABLE "analysis_model_budget_events" ADD CONSTRAINT "analysis_model_budget_events_latency_ms_check" CHECK ("analysis_model_budget_events"."latency_ms" IS NULL OR "analysis_model_budget_events"."latency_ms" >= 0);