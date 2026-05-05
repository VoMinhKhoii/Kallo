SET search_path TO public, extensions;

CREATE TABLE "pipeline_request_replay_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_user_id_hash" text NOT NULL,
	"original_request_id" uuid NOT NULL,
	"replay_request_id" uuid NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL
);
ALTER TABLE "pipeline_request_replay_audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX "pipeline_replay_audit_original_idx" ON "pipeline_request_replay_audit_logs" USING btree ("original_request_id");--> statement-breakpoint
CREATE INDEX "pipeline_replay_audit_replay_idx" ON "pipeline_request_replay_audit_logs" USING btree ("replay_request_id");--> statement-breakpoint
CREATE INDEX "pipeline_replay_audit_admin_created_idx" ON "pipeline_request_replay_audit_logs" USING btree ("admin_user_id_hash","created_at");--> statement-breakpoint
ALTER TABLE "pipeline_shadow_runs" ADD CONSTRAINT "pipeline_shadow_runs_primary_run_id_pipeline_runs_id_fk" FOREIGN KEY ("primary_run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_shadow_runs_primary_run_idx" ON "pipeline_shadow_runs" USING btree ("primary_run_id");
