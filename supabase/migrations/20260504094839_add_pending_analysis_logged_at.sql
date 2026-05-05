ALTER TABLE "pending_analyses" ADD COLUMN "logged_at" timestamp with time zone;--> statement-breakpoint
UPDATE "pending_analyses"
SET "logged_at" = "created_at"
WHERE "logged_at" IS NULL;--> statement-breakpoint
ALTER TABLE "pending_analyses" ALTER COLUMN "logged_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pending_analyses" ALTER COLUMN "logged_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "pending_analyses_user_logged_at_idx" ON "pending_analyses" USING btree ("user_id","logged_at");
