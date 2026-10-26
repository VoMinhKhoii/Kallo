-- =============================================================================
-- Domain A (Drizzle-generated) — drop the merged analysis guard's tables
--
-- `analysis_rate_limit_windows`, `analysis_in_flight_limits` and
-- `analysis_guard_events` belonged to the analysis guard, which was merged
-- into the one rate limiter (`rate_limit_counters`, `rate_limit_events`).
-- PUSH ONLY AFTER that code is deployed: the revision before it still writes
-- these tables on every guarded request. Their reapers and cron jobs go first,
-- in 20261025185300_drop_analysis_guard_reapers.
-- =============================================================================
DROP TABLE "analysis_guard_events" CASCADE;--> statement-breakpoint
DROP TABLE "analysis_in_flight_limits" CASCADE;--> statement-breakpoint
DROP TABLE "analysis_rate_limit_windows" CASCADE;
