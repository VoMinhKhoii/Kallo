ALTER TABLE "pipeline_llm_calls" ALTER COLUMN "prompt_rendered" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "meal_name" text;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "model_profile" text;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "models" text[];--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "calories_kcal" numeric;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "protein_g" numeric;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "carbohydrate_g" numeric;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "fat_g" numeric;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "item_count" integer;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "error_code" text;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD COLUMN "trace_logged" boolean;--> statement-breakpoint
CREATE INDEX "analysis_guard_events_created_idx" ON "analysis_guard_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pipeline_replay_audit_created_idx" ON "pipeline_request_replay_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pipeline_requests_created_id_idx" ON "pipeline_requests" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "synonym_candidates_created_idx" ON "synonym_candidates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "unmatched_ingredients_created_idx" ON "unmatched_ingredients" USING btree ("created_at");