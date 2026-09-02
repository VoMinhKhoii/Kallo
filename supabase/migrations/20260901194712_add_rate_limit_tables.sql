-- =============================================================================
-- Domain A (Drizzle-generated) — rate_limit_counters + rate_limit_events
--
-- The trailing ENABLE ROW LEVEL SECURITY / REVOKE / GRANT block is the narrow
-- failure-boundary exception documented in docs/DATABASE.md § "Domain B":
-- both tables are server-only, and if a follow-up Domain B migration failed to
-- apply the tables would otherwise sit in the ledger client-readable — an
-- anon-key SELECT over `rate_limit_events` would expose which routes are being
-- throttled, and INSERT/UPDATE over `rate_limit_counters` would let a client
-- pre-exhaust anyone else's quota. Policies, functions, triggers and the
-- storage/retention DDL still live in their own Domain B migrations.
-- =============================================================================

CREATE TABLE "rate_limit_counters" (
	"key_kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"route" text NOT NULL,
	"minute_start" timestamp with time zone NOT NULL,
	"minute_count" integer DEFAULT 0 NOT NULL,
	"hour_start" timestamp with time zone NOT NULL,
	"hour_count" integer DEFAULT 0 NOT NULL,
	"day_start" timestamp with time zone NOT NULL,
	"day_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY("key_kind","key_hash","route"),
	CONSTRAINT "rate_limit_counters_key_kind_check" CHECK ("rate_limit_counters"."key_kind" IN ('user', 'ip', 'account', 'recipient', 'global')),
	CONSTRAINT "rate_limit_counters_minute_count_check" CHECK ("rate_limit_counters"."minute_count" >= 0),
	CONSTRAINT "rate_limit_counters_hour_count_check" CHECK ("rate_limit_counters"."hour_count" >= 0),
	CONSTRAINT "rate_limit_counters_day_count_check" CHECK ("rate_limit_counters"."day_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"route" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"key_kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"retry_after_seconds" integer,
	"hits" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_events_route_created_idx" ON "rate_limit_events" USING btree ("route","created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_events_created_idx" ON "rate_limit_events" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON "rate_limit_counters" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "rate_limit_events" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit_counters" TO service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit_events" TO service_role;