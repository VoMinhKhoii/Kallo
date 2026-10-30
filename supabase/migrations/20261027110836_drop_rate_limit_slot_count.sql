ALTER TABLE "rate_limit_counters" DROP CONSTRAINT "rate_limit_counters_slot_count_check";--> statement-breakpoint
ALTER TABLE "rate_limit_counters" DROP COLUMN "slot_count";--> statement-breakpoint
ALTER TABLE "rate_limit_counters" DROP COLUMN "slot_expires_at";