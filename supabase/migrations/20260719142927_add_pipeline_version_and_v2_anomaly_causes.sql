-- Phase 0 + Phase 4 pipeline telemetry columns (drizzle-generated shell;
-- body hand-edited for backfill + lock-safe NOT NULL, which generation
-- cannot produce).
--
-- pipeline_version: which pipeline (v1/v2) produced a pipeline_runs row —
-- pre-existing rows are classified from the v2_run anomaly marker.
-- v2_anomaly_causes: nullable jsonb per-cause anomaly counts for a v2 run.
--
-- The application code tolerates BOTH columns being absent (42703
-- strip-and-retry in run-telemetry.ts / grounded-telemetry.ts), so deploying
-- code before this migration is safe.
ALTER TABLE "pipeline_runs" ADD COLUMN "pipeline_version" text;--> statement-breakpoint
UPDATE "pipeline_runs"
SET "pipeline_version" = CASE
  WHEN "anomaly_types" @> ARRAY['v2_run']::text[] THEN 'v2'
  ELSE 'v1'
END;--> statement-breakpoint
-- Lock-safe NOT NULL: validate via a NOT VALID check constraint first so the
-- full-table verification scan happens WITHOUT blocking writes; SET NOT NULL
-- then reuses the validated constraint (PG12+) instead of rescanning under an
-- exclusive lock.
ALTER TABLE "pipeline_runs"
  ADD CONSTRAINT "pipeline_runs_pipeline_version_not_null"
  CHECK ("pipeline_version" IS NOT NULL) NOT VALID;--> statement-breakpoint
ALTER TABLE "pipeline_runs"
  VALIDATE CONSTRAINT "pipeline_runs_pipeline_version_not_null";--> statement-breakpoint
ALTER TABLE "pipeline_runs" ALTER COLUMN "pipeline_version" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_runs"
  DROP CONSTRAINT "pipeline_runs_pipeline_version_not_null";--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "v2_anomaly_causes" jsonb;
