-- =============================================================================
-- Domain A (Drizzle-generated) — ai_spend_days + one-at-a-time slot columns
--
-- `ai_spend_days` is the app-wide AI spend brake's ledger (one row per UTC
-- day); the two `rate_limit_counters` columns hold the per-key slot that
-- `rate_limit_consume` grants and `rate_limit_release` frees. Both are only
-- read through those functions (20261025133900_rate_limit_spend_and_slots).
--
-- The trailing ENABLE ROW LEVEL SECURITY / REVOKE / GRANT block is the narrow
-- failure-boundary exception documented in docs/DATABASE.md § "Domain B": the
-- table is server-only, and an anon-key UPDATE over it would let a client
-- trip (or reset) the brake for everybody.
-- =============================================================================
CREATE TABLE "ai_spend_days" (
	"day" date PRIMARY KEY NOT NULL,
	"spent_micro_usd" bigint DEFAULT 0 NOT NULL,
	"first_blocked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_spend_days_spent_check" CHECK ("ai_spend_days"."spent_micro_usd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ADD COLUMN "slot_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ADD COLUMN "slot_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ADD CONSTRAINT "rate_limit_counters_slot_count_check" CHECK ("rate_limit_counters"."slot_count" >= 0);--> statement-breakpoint
ALTER TABLE "ai_spend_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "ai_spend_days" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_spend_days" TO service_role;
