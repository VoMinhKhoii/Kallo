CREATE TABLE "pipeline_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"raw_input" text NOT NULL,
	"user_context_json" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_requests_status_check" CHECK ("pipeline_requests"."status" IN ('pending', 'success', 'error'))
);
--> statement-breakpoint
ALTER TABLE "unmatched_ingredients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_requests" ADD CONSTRAINT "pipeline_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_requests_user_created_idx" ON "pipeline_requests" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "unmatched_ingredients" ADD CONSTRAINT "unmatched_ingredients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;