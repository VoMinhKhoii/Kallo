ALTER TABLE "pipeline_runs" ADD COLUMN "rrf_sampled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "rrf_disagreement_count" smallint;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "rrf_ingredients_observed" smallint;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "rrf_measurement_latency_ms" integer;