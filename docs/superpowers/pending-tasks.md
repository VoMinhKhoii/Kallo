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

---

## `ingredient_query_embeddings` growth control

**Priority:** Medium (before reaching 10k+ rows)
**Context:** This table caches Gemini embeddings for user-queried ingredient strings to avoid re-calling the API. It grows organically with usage, shared across all users (one user's "thịt bò" benefits everyone).

**Problem:** The table will grow unboundedly. At scale (1k users × 5 ingredients × 3 meals = 15k calls/day with ~20% cache miss rate), it accumulates ~3k new rows/day. After 3 months: ~270k rows. The warm-up does NOT read from this table (it reads from `vietnamese_food_composition`), so memory is not affected — but the table size and index performance will degrade.

**LLM non-determinism risk:** The LLM may output "Thịt bò" and "thịt bò tươi" as separate ingredients for the same food. `normalizeIngredientKey()` handles case/whitespace, but semantically similar but textually different strings still create separate entries. This is acceptable (they may match different foods), not a bug.

**Options:**

1. **pg_cron TTL** — `DELETE FROM ingredient_query_embeddings WHERE created_at < now() - interval '90 days'` (scheduled monthly; requires pg_cron)
2. **Usage-frequency cap** — add a `use_count` column, delete rows with use_count = 1 older than 30 days (cold cache eviction)
3. **Redis migration** — replace DB-backed cache with Redis (TTL-native, sub-ms lookup, cluster-safe). Ideal when multi-instance deployment is needed.

**Recommendation:** Option 3 (Redis) when the app scales beyond a single Next.js instance. Option 1 (pg_cron TTL) as interim when row count exceeds 50k.
