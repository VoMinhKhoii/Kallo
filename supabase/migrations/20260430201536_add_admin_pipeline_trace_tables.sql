CREATE TABLE "pipeline_llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"stage_log_id" uuid NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_rendered" text NOT NULL,
	"response_raw" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"stage_index" integer NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"status" text NOT NULL,
	"error" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stage_logs_stage_chk" CHECK ("pipeline_stage_logs"."stage" IN ('decomposition','matching','nutrition','assembly')),
	CONSTRAINT "pipeline_stage_logs_status_chk" CHECK ("pipeline_stage_logs"."status" IN ('success','error','skipped'))
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code_hash" text NOT NULL,
	"template_sample" text NOT NULL,
	"model" text NOT NULL,
	"git_sha" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_versions_name_hash_uq" UNIQUE("name","code_hash")
);
--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "prompt_versions_used" jsonb;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "replay_of_request_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_llm_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline_stage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pipeline_llm_calls" ADD CONSTRAINT "pipeline_llm_calls_request_id_pipeline_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_llm_calls" ADD CONSTRAINT "pipeline_llm_calls_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage_logs" ADD CONSTRAINT "pipeline_stage_logs_request_id_pipeline_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_llm_calls_req_idx" ON "pipeline_llm_calls" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "pipeline_llm_calls_pv_idx" ON "pipeline_llm_calls" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "pipeline_llm_calls_stage_log_idx" ON "pipeline_llm_calls" USING btree ("stage_log_id");--> statement-breakpoint
CREATE INDEX "pipeline_stage_logs_req_idx" ON "pipeline_stage_logs" USING btree ("request_id","stage_index");--> statement-breakpoint
CREATE INDEX "prompt_versions_name_first_seen_idx" ON "prompt_versions" USING btree ("name","first_seen_at" DESC);--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD CONSTRAINT "pipeline_requests_replay_of_fk" FOREIGN KEY ("replay_of_request_id") REFERENCES "public"."pipeline_requests"("id") ON DELETE set null ON UPDATE no action;
