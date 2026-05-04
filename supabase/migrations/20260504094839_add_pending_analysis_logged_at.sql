ALTER TABLE "pending_analyses" ADD COLUMN "logged_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "pending_analyses_user_logged_at_idx" ON "pending_analyses" USING btree ("user_id","logged_at");
