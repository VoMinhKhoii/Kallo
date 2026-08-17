# Database Architecture

## Stack

- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM (`drizzle-orm/postgres-js`)
- **Migration tool**: `drizzle-kit generate` → Supabase CLI applies

## Bounded Source of Truth

This project enforces a two-domain model. Do not mix responsibilities.

### Domain A — Application Data Shape (Drizzle owns this)

`lib/db/schema.ts` is the single source of truth for:
- Tables, columns, types, defaults
- Foreign keys, indexes
- CHECK constraints (via Drizzle's `check()` API)

**Workflow when schema changes:**
1. Edit `lib/db/schema.ts`
2. Run `bunx drizzle-kit generate` → outputs a new timestamped SQL file to `supabase/migrations/`
3. Rename the generated file to match a real Supabase timestamp if needed (see Naming Convention below)
4. Apply via `supabase db push`

Never hand-write DDL for tables/columns. Never add CHECK constraints directly in SQL files.

### Shared staging preview rule

While `PREVIEW_DATABASE_MODE=shared`, PR previews and `nham-internal` point at
the same non-prod Supabase database. To keep that survivable:

- prefer append-only migrations for normal feature work
- do not add new migrations that `DROP TABLE`, `DROP COLUMN`,
  `RENAME COLUMN`, or `ALTER COLUMN TYPE`
- add new columns/tables first, migrate application code, and defer cleanup to
  an intentional maintenance pass

CI enforces this append-only rule against newly changed migration files via
`scripts/ci/check-append-only-migrations.mjs`.

If shared staging gets into a bad state, recover it with the manual
`Reset Staging Database` GitHub Actions workflow. That reset replays the current
migrations from the default branch, runs `supabase/seed.sql`, and then reapplies
the generated `seed_food.sql` artifact from GCS so search/embedding state is
restored too.

### Domain B — Security & Database Logic (Raw SQL owns this)

Supabase-specific features are maintained as hand-authored SQL migration files:
- RLS `ENABLE` / `CREATE POLICY`
- Postgres functions and triggers (e.g., `handle_new_user`)

These files are never generated or touched by `drizzle-kit`. Create them with `supabase migration new <name>`.

One narrow failure-boundary exception is allowed for a newly created
server-only table: append only `ENABLE ROW LEVEL SECURITY` and `REVOKE` to its
generated create-table migration when a later migration failure could otherwise
leave the table client-accessible. Policies, functions, and triggers still live
in a separate Domain B migration. Document the exception in the migration.

## File Locations

| Path | Purpose |
|------|---------|
| `lib/db/schema.ts` | Drizzle schema — Domain A source of truth |
| `lib/db/index.ts` | Drizzle client (`db` export) |
| `drizzle.config.ts` | Drizzle config — `out` points to `supabase/migrations/` |
| `supabase/migrations/` | All migration SQL files (Drizzle-generated + manual) |
| `supabase/migrations/meta/` | Drizzle internal state — do not edit manually |

## Migration Naming Convention

Supabase uses timestamp-based filenames: `YYYYMMDDHHMMSS_description.sql`

- Drizzle-generated files are renamed after generation to match this format
- The `meta/_journal.json` tag and `meta/<timestamp>_snapshot.json` filename must be kept in sync with the renamed SQL file

## Current Migrations

| File | Domain | Description |
|------|--------|-------------|
| `20260224095657_setup_user_profiles.sql` | A (Drizzle) | `user_profiles` table with all columns and CHECK constraints |
| `20260224100032_rls_and_triggers.sql` | B (Manual) | RLS policies + `handle_new_user` trigger |
| `20260226172553_add_food_composition.sql` | A (Drizzle) | `vietnamese_food_composition` table with 38 columns |
| `20260226172614_food_composition_rls.sql` | B (Manual) | Read-only RLS policy for food composition data |
| `20260228154026_add_meals_weight_tables.sql` | A (Drizzle) | `meals`, `meal_items`, `body_weight_log`, `unmatched_ingredients` tables |
| `20260228155000_add_search_columns.sql` | A (Drizzle) | `search_text` + `embedding` (vector(768)) columns on food composition |
| `20260228155119_pgvector_embeddings.sql` | B (Manual) | pgvector extension, HNSW index, `match_ingredients()` function |
| `20260228155500_add_search_text_ascii.sql` | A (Drizzle) | `search_text_ascii` column on food composition |
| `20260228155945_rls_new_tables.sql` | B (Manual) | RLS policies + `updated_at` triggers for meals/weight tables |
| `20260301022622_pg_trgm_ingredient_search.sql` | B (Manual) | pg_trgm + unaccent extensions, dual GIN indexes, `fuzzy_match_ingredients()` with diacritic routing |
| `20260319031724_add_query_embeddings_cache.sql` | A (Drizzle) | `ingredient_query_embeddings` table — bilingual query-side embeddings cache |
| `20260319031800_rls_query_embeddings.sql` | B (Manual) | RLS policies + GIN trgm indexes on `name_vi`/`name_en` for tiered lookup |
| `20260319034000_seed_query_embeddings_from_fct.sql` | B (Manual) | Seed cache from `vietnamese_food_composition` (name_vi + name_en per row) |
| `20260319083757_add_synonym_candidates.sql` | A (Drizzle) | `synonym_candidates` table for cross-language match logging |
| `20260319083800_rls_synonym_candidates.sql` | B (Manual) | RLS policies for synonym_candidates (read/write/update for authenticated) |
| `20260319083900_normalize_query_embeddings_keys.sql` | B (Manual) | Normalize existing `name_vi` PKs to lowercase + NFC (with collision resolution) |
| `20260416161845_flatten_meal_nutrition_values.sql` | A (Drizzle) | Flatten persisted `meals` and `meal_items` nutrient columns from JSONB bounds to single numeric values |
| `20260708111129_add_chat_groups.sql` | A (Drizzle) | `chat_groups`, `chat_group_members`, `chat_group_messages` tables — unified 1:1 + group chat |
| `20260708111205_chat_groups_rls.sql` | B (Manual) | RLS policies + `updated_at` trigger for the chat groups tables |
| `20260708141431_add_chat_group_members_last_read_at.sql` | A (Drizzle) | `chat_group_members.last_read_at` — per-member read marker driving the unread indicator |
| `20260708141500_chat_group_members_last_read_rls.sql` | B (Manual) | RLS UPDATE policy so a member can bump their own `last_read_at` |
| `20260728123331_add_billing_reconciliation.sql` | A + deny boundary | RevenueCat grants, CustomerInfo + deterministic ownership watermarks, webhook replay state, indexes, constraints, and same-transaction RLS/revokes |
| `20260728123400_harden_billing_trial_anchor.sql` | B (Manual) | Preserve the server-created trial anchor when profiles are updated |
| `20260801120000_curate_broth_search_names.sql` | B (Manual) | Curated Vietnamese broth names/variants; queues targeted embedding regeneration |

**Migration ordering matters**: Drizzle migrations that add columns must be timestamped BEFORE manual migrations that reference those columns (e.g., `search_text` column must exist before the trgm migration creates a GIN index on it).

## Meal Persistence Contract

- The analysis pipeline keeps bounded nutrition in memory as
  `{ low, mid, high }` while LLM adjustment is still in play.
- Persisted `meals` and `meal_items` rows store **flat numeric nutrient values**.
- For persisted meal history:
  - `calories_kcal`, `protein_g`, `carbohydrate_g`, and `fat_g` store the
    goal-adjusted values shown to the user.
  - All other nutrient columns store the gram-scaled nutrient totals directly.
- Legacy rows that still contain true bounded macro objects cannot be
  reconstructed exactly because meals do not store historical goal/aggression
  snapshots. The flattening migration only preserves macro rows that were
  already effectively flat (`low = mid = high`) and leaves ambiguous legacy
  macro values null instead of inventing new ones from the current profile.
- The same legacy-nulling rule is applied to child `meal_items` macro columns
  whenever the parent meal-level macro is ambiguous, so old persisted cards do
  not show contradictory totals vs item/group subtotals.

## Ingredient Search Architecture

The app uses a two-tier search pipeline to match user meal descriptions to the 526 food composition records:

### Tier 1: pg_trgm Fuzzy Search (Primary)

**Function**: `fuzzy_match_ingredients(query_text, match_count, threshold)`

- Free, instant, no external API calls
- Uses trigram similarity (`pg_trgm`) against concatenated name fields
- Handles partial matches, typos, and cooking method prefixes

#### Diacritic Routing (Critical Design Decision)

Vietnamese diacritics are **semantically load-bearing**: `bò` = beef, `bơ` = butter, `bổ` = nutritious. The function detects whether the query contains diacritics and routes to the correct search column:

| Query type | Detection | Column searched | Example |
|---|---|---|---|
| Has diacritics | `unaccent(query) != query` | `search_text` (original Vietnamese) | "Nước mắm" → exact match |
| No diacritics | `unaccent(query) == query` | `search_text_ascii` (lowered + unaccented) | "nuoc mam" → finds "Nước mắm" |

**Never normalize both sides** — this causes semantic collisions (bò/bơ/bổ would all collapse to "bo").

#### Search Text Columns

| Column | Content | Purpose |
|---|---|---|
| `search_text` | `name_primary \| name_alt \| name_en` | Diacritic-aware trigram search |
| `search_text_ascii` | `lower(unaccent(search_text))` | No-diacritic fallback search |

Both columns are populated by a trigger on INSERT/UPDATE.

### Tier 2: pgvector Cosine Similarity (Fallback)

**Function**: `match_ingredients(query_embedding, match_count, threshold)`

- Used when trgm fails (e.g., synonyms: "cơm trắng" → "Gạo tẻ máy")
- Requires query embedding — resolved via tiered cache (see below)
- HNSW index for fast approximate nearest neighbor search

#### Embeddings

- **Model**: `gemini-embedding-001` (768 dimensions)
- **Embedding text**: `name_primary | name_alt | name_en | type_vn | type_en` (food group categories add semantic context)
- **Backfill script**: `scripts/db/backfill_embeddings.ts`
- All 526 rows have embeddings pre-populated

#### Query Embedding Cache (Tiered Lookup)

The query-side embedding (for the ingredient name output by the LLM) is resolved via a tiered cache to avoid runtime Gemini API calls:

| Tier | Source | Latency | Location |
|------|--------|---------|----------|
| L1 | In-memory `Map<string, number[]>` | ~0ms | `lib/ai/cache/embedding-cache.ts` |
| L2 | Exact match: `WHERE name_vi = $1` | ~1-3ms | Supabase (PK scan) |
| L3 | Gemini API (`gemini-embedding-001`) | ~400-700ms | External API (rare after seed) |

**Input normalization**: All inputs are normalized via `normalizeIngredientKey()` (NFC + lowercase + trim) at the entry point of both `resolveQueryEmbedding()` and `cacheQueryEmbedding()`, before any tier is checked.

- **L1 hit**: Returns immediately from process memory. Lost on server restart.
- **L2 hit**: Exact match on `name_vi` or `lower(name_en)`. Promotes both `name_vi` and `name_en` into L1.
- **L2 miss**: Neither `name_vi` nor `lower(name_en)` matched. The system logs a `synonym_candidates` row asynchronously (fire-and-forget) and continues to L3.
- **L3 fallback**: Calls Gemini API, then fire-and-forget inserts into L2 (as `name_vi`) + sets L1. `ON CONFLICT DO NOTHING` for concurrency safety.
- **Provider memo (in front of L3)**: `lib/ai/cache/provider-embedding-memo.ts` is a second in-memory map at the SDK call boundary, keyed on the **raw** text (no `normalizeIngredientKey`), so it is not interchangeable with L1. It catches the speculative-prewarm race (background embed lands after the matcher's L1 read) and is the only cache left when `PIPELINE_EMBEDDING_CACHE_ENABLED=false`. Unbounded, no TTL.
- **L1 priming**: `warmEmbeddingCache()` is now explicit only; the live request path does not kick off a full-table warm-up on cache miss. L1 is primarily primed by `nutrition-cache.loadAll()` when VN FCT rows are fetched, avoiding extra DB contention on cold requests.
- **pg_trgm**: Removed from the live lookup path. GIN trgm indexes remain for a future background synonym discovery job that writes to `synonym_candidates`.
- **Seed migration**: `20260319034000_seed_query_embeddings_from_fct.sql` copies `(name_primary, name_en, embedding)` from `vietnamese_food_composition`.
- **Table**: `ingredient_query_embeddings(name_vi TEXT PK, name_en TEXT, embedding VECTOR(768), created_at TIMESTAMPTZ)`
- **Indexes**: B-tree on `name_en`, GIN trgm on `name_vi` and `name_en` (for background job)
- **Translation backfill**: `scripts/db/backfill-translations.ts` fills NULL `name_en` (vi→en) or `name_vi` (en→vi) via Google Cloud Translation API

#### Synonym Candidates

Cross-language and near-miss matches are logged for human review:

- **Table**: `synonym_candidates(id SERIAL PK, queried_vi TEXT, matched_en TEXT, matched_vi TEXT, created_at TIMESTAMPTZ, reviewed BOOLEAN)`
- **Written by**: (1) Async name_en check on embedding cache miss, (2) future background trgm job
- **Not used in live path** — candidates are surfaced for review only, never auto-resolved

### Pipeline Flow (App-Level)

```
User describes meal → LLM decomposes into ingredients
  → For each ingredient:
    1. Normalize name: NFC + lowercase + trim
    2. Resolve query embedding (L1 memory → L2 exact name_vi → L3 Gemini API)
       On L2 miss: async check name_en → log synonym_candidate if match
    3. match_ingredients(embedding) via pgvector
    4. If no good vector match → fuzzy_match_ingredients(name) via pg_trgm
    5. LLM picks the best candidate from results
```

## DB Client Usage

```ts
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';

const profile = await db.query.userProfiles.findFirst({
  where: (t, { eq }) => eq(t.userId, userId),
});
```

The `db` instance uses `postgres-js` under the hood with `DATABASE_URL` from env.

## CLI Commands

### Local (Drizzle)

| Command | Description |
|---------|-------------|
| `bun db:generate` | Generate migration from schema changes |
| `bun db:migrate` | Apply migrations locally via Drizzle |
| `bun db:studio` | Open Drizzle Studio (DB browser) |

### Remote (Supabase)

| Command | Description |
|---------|-------------|
| `bun dbr:reset` | Reset linked remote DB, re-run migrations + seed + backfill embeddings |
| `bun dbr:reset:nobackfill` | Reset linked remote DB without embedding backfill |
| `bun dbr:push` | Push local migrations to remote |
| `bun dbr:pull` | Pull remote schema changes into local migrations |
| `bun dbr:diff` | Diff local schema against remote |
| `bun dbr:status` | List migration status on remote |

### Testing

| Command | Description |
|---------|-------------|
| `bun test` | Run all tests via Vitest |
| `bun test:watch` | Run tests in watch mode |
| `bun --env-file=.env.local vitest run lib/db/__tests__/` | Run DB-level search tests (requires remote DB) |

### Scripts

| Command | Description |
|---------|-------------|
| `bun --env-file=.env.local scripts/db/backfill_embeddings.ts` | Backfill embeddings via Gemini API (rate-limited) |
| `bun --env-file=.env.local scripts/db/backfill_embeddings.ts --ids=<id,...>` | Force-regenerate embeddings for specific food rows |

## Seeding Reference Data

`bun dbr:reset` runs `supabase db reset --linked` which applies all migrations and runs `supabase/seed.sql` automatically.
The seed file inserts all 526 VTN FCT 2007 records into `vietnamese_food_composition`.

**After seeding**, `dbr:reset` automatically runs the embedding backfill via Gemini API. This takes ~5 minutes due to rate limiting (100 req/min free tier). Use `dbr:reset:nobackfill` to skip this step if embeddings are not needed.

Data-curation migrations that change food names should set the affected
`embedding` values to `NULL`. The production Cloud Run deploy detects those rows
after applying migrations and runs the backfill before deploying the new revision.
Because Supabase applies migrations before `seed.sql`, curation migrations for
separately imported USDA rows must tolerate those rows being absent in a fresh
FAO-only reset. The backfill script verifies that no rows in its scope still have
NULL embeddings before the deploy can continue.
For a local or targeted repair, pass the affected IDs to `backfill_embeddings.ts`
with `--ids` so existing non-null vectors are regenerated from the new names.

## Known Quirks & Gotchas

### Supabase Remote DB

- **`dbr:push` search_path**: The CLI login role doesn't have `extensions` schema on search_path. Migrations using pgvector/pg_trgm must include `SET search_path TO public, extensions;` at the top.
- **No `ai` schema**: This project does NOT have the Supabase AI schema — no in-database embedding generation. Use the external backfill script instead.
- **`dbr:push` doesn't run seed.sql** — only `dbr:reset` does.
- **`dbr:reset` (and `dbr:reset:nobackfill`)** requires interactive `y` confirmation.
- **Failed migration repair**: `supabase migration repair --status reverted <timestamp> --linked`

### Drizzle + Supabase Coexistence

- Drizzle migrations must be timestamped **before** manual migrations that reference their columns.
- When reordering, update `meta/_journal.json` entries AND rename `meta/<timestamp>_snapshot.json` files.
- `migrations.prefix: 'supabase'` in `drizzle.config.ts` enables timestamp-based naming.

### PostgreSQL

- **Generated columns** cannot use `array_to_string()` (not IMMUTABLE in Supabase) — use triggers instead.
- **TRUNCATE** on tables with FK references needs `CASCADE` — the seed file avoids TRUNCATE entirely.
- `unaccent()` requires the `unaccent` extension to be created first.

### Bun

- `bun` does NOT auto-load `.env.local` for scripts — use `--env-file=.env.local` flag.
- `DATABASE_URL` password may contain `?` or `#` — use `encodeDbUrl()` from `@/lib/db` to safely encode.

### Embeddings (Gemini)

- **Model**: `gemini-embedding-001` — sunset Jul 14, 2026. `text-embedding-004` is deprecated.
- **Free tier**: 100 requests/minute, 1000 requests/day **per project** (not per key).
- Each text in a batch counts as a separate request.
- The backfill script uses 35s delay between batches of 50 to stay under limits.

## pipeline_requests retention (Decision A)

`pipeline_requests` stores raw meal input + `userContextJson` for short-window
operational debugging only. Access is service-role-only (RLS with no policies).
Retention is 7 days enforced by `public.reap_pipeline_requests()`, scheduled
daily via `pg_cron` when the extension is granted; otherwise the function must
be invoked from a daily worker.

`pipeline_runs` (this spec, §0.4) is the analytics source — it stores
`user_id_hash` only, never raw input.

## Task 1.6 audit: SQL match function state projection

`match_ingredients_by_source` and `fuzzy_match_ingredients_by_source`
(introduced in `20260412143500_add_source_aware_match_functions.sql`)
already project the `state` column in their `RETURNS TABLE` signature.
The cascade in `lib/ai/matching/source-matching.ts` exclusively calls
these `_by_source` variants, so no additional migration is required for
DB-state propagation.
