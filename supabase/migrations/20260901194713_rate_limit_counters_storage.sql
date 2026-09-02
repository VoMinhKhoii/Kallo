-- =============================================================================
-- Domain B: Database Security & Logic — rate_limit_counters storage tuning
-- Source of Truth: Raw SQL (DO NOT generate with drizzle-kit)
--
-- SOFT-STATE TRADE-OFF (deliberate, and the reason this is its own migration):
-- an UNLOGGED table writes no WAL, which means its contents are TRUNCATED on
-- crash recovery, are NOT streamed to physical replicas, and do NOT appear in
-- PITR / base backups. For a rate limiter that is the right trade: the row is
-- a counter with a two-day lifetime, every consume rewrites it, and losing the
-- table costs at most one window of accumulated quota (attackers get one
-- reset; users get one free minute) in exchange for removing the limiter from
-- the WAL path entirely — this table is written on EVERY guarded request,
-- including unauthenticated auth-proxy traffic, so it would otherwise be the
-- single hottest WAL producer in the database.
--
-- `rate_limit_events` is deliberately left LOGGED: it is the audit trail, and
-- an audit trail that vanishes on the crash you are investigating is worthless.
--
-- fillfactor 70 leaves free space in each page so the consume upsert's UPDATEs
-- can write HOT tuples on the same page instead of a new one. There is no
-- secondary index on this table, so HOT applies to essentially every update
-- and autovacuum can reclaim in place.
-- =============================================================================

ALTER TABLE public.rate_limit_counters SET UNLOGGED;

ALTER TABLE public.rate_limit_counters SET (fillfactor = 70);
