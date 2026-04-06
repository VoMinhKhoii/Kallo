# Pending Tasks

Small improvements to be executed when convenient. Not urgent, not blocking.

## Expired `pending_analyses` cleanup

**Priority:** Low
**Context:** PostgreSQL has no automatic TTL row deletion. The `expires_at` column in `pending_analyses` is only used by app-layer queries to filter. Expired rows accumulate indefinitely.

**Current state:** 8 expired rows, ~5 KB each. Growth rate: ~1,000 rows/day at heavy usage (~5 MB/day).

**Options:**

1. **pg_cron** — `SELECT cron.schedule('cleanup-expired-analyses', '0 * * * *', $$DELETE FROM pending_analyses WHERE expires_at < now()$$);` (requires `pg_cron` extension, available on Supabase Pro)
2. **Supabase Edge Function** — scheduled via `supabase functions deploy` with cron trigger
3. **App-level** — delete expired rows opportunistically during `POST /api/analyze-meal`

**Recommendation:** Option 1 (pg_cron) when upgrading to Supabase Pro, or Option 3 as a quick win.
