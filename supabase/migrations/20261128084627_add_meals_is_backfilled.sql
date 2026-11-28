ALTER TABLE "meals" ADD COLUMN "is_backfilled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD COLUMN "is_backfilled" boolean DEFAULT false NOT NULL;