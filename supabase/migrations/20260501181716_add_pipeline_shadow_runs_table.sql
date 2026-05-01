CREATE TABLE "pipeline_shadow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text NOT NULL,
	"primary_run_id" uuid,
	"candidate_prompt_label" text NOT NULL,
	"candidate_model" text NOT NULL,
	"primary_output" jsonb NOT NULL,
	"candidate_output" jsonb NOT NULL,
	"divergence" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"candidate_ms" integer DEFAULT 0 NOT NULL
);
