ALTER TABLE "pipeline_runs" ADD COLUMN "pipeline_version" text;
--> statement-breakpoint
UPDATE "pipeline_runs"
SET "pipeline_version" = CASE
  WHEN "anomaly_types" @> ARRAY['v2_run']::text[] THEN 'v2'
  ELSE 'v1'
END;
--> statement-breakpoint
-- Lock-safe NOT NULL: validate via a NOT VALID check constraint first so the
-- full-table verification scan happens WITHOUT blocking writes; the final
-- SET NOT NULL then reuses the validated constraint (PG12+) instead of
-- rescanning under an exclusive lock.
ALTER TABLE "pipeline_runs"
  ADD CONSTRAINT "pipeline_runs_pipeline_version_not_null"
  CHECK ("pipeline_version" IS NOT NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "pipeline_runs"
  VALIDATE CONSTRAINT "pipeline_runs_pipeline_version_not_null";
--> statement-breakpoint
ALTER TABLE "pipeline_runs" ALTER COLUMN "pipeline_version" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "pipeline_runs"
  DROP CONSTRAINT "pipeline_runs_pipeline_version_not_null";
