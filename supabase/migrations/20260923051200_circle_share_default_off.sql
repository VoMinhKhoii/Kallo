ALTER TABLE "user_profiles" ALTER COLUMN "auto_share_to_circle" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "auto_share_updated_at" timestamp with time zone;