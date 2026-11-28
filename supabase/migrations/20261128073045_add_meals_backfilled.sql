ALTER TABLE "meals" ADD COLUMN "backfilled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_analyses" ADD COLUMN "backfilled" boolean DEFAULT false NOT NULL;