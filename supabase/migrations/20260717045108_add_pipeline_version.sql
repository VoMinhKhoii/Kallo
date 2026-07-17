ALTER TABLE "pipeline_runs" ADD COLUMN "pipeline_version" text;
--> statement-breakpoint
UPDATE "pipeline_runs"
SET "pipeline_version" = CASE
  WHEN "anomaly_types" @> ARRAY['v2_run']::text[] THEN 'v2'
  ELSE 'v1'
END;
--> statement-breakpoint
ALTER TABLE "pipeline_runs" ALTER COLUMN "pipeline_version" SET NOT NULL;
