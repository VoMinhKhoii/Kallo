# AI Pipeline — Prompt / Context / Harness Engineering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the seven-phase quality/correctness/reliability layer described in `docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md` on top of the v2 latency pipeline — without touching `pipeline_llm_outputs` (owned by the debug-dashboard worktree).

**Architecture:** Foundations first (stable IDs, DB-state propagation, prompt/schema versioning, `pipeline_runs` telemetry, privacy reckoning on `pipeline_requests`), then a type-safe prompt rewrite, then absolute-macro schema + validators, then post-launch shadow-runner infra, then adaptive-compute, then dish-wrapped decomposition, then RRF measurement. Each phase is independently shippable and reversible. The LLM emits absolute final macros (no factor schema); deterministic code applies goal/aggression preferences and validates physical-consistency invariants.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (`postgres-js`), Supabase (Postgres + RLS + pg_trgm + pgvector), `@google/generative-ai` (Gemini), Vitest, Biome 2.4.2, Zod, Bun runtime/test runner. Conventional commits with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.

**Spec sections:** §0 (foundations) → §3 (type-safe prompts) → §1 (absolute macros) → §5 (eval flywheel) → §4 (adaptive compute) → §2 (dish-wrapped decomposition) → §2.4 (RRF measurement).

**Resolved decisions baked in:**
- **Decision A** — `pipeline_requests`: 7-day TTL + service-role-only RLS (Chunk 1).
- **Decision B** — Shadow A/B sampling at static 5% with deterministic per-request hash routing (Chunk 4).
- **Pushback locks:** drop `sourcePrior`/`sourceOverride`; LLM emits absolute final macros (no factor schema); §3 ships pre-shadow-runner; streaming keeps incremental behavior + 10% retry-rate guard; drop `addedFat`; rewrite Principle A as "no leakage of preference targets"; raw LLM-output logging is delegated entirely to a separate debug-dashboard worktree (no `pipeline_llm_outputs` here).

---

## File Structure

This plan creates and modifies the following files. Files that change together live together; new responsibilities map to new modules where the existing file would grow unwieldy.

### Created

- `lib/ai/pipeline/versions.ts` — single source of truth for `DECOMPOSITION_PROMPT_VERSION`, `NUTRITION_PROMPT_VERSION`, `DECOMPOSITION_SCHEMA_VERSION`, `NUTRITION_SCHEMA_VERSION` constants. Imported by prompts, schemas, telemetry, and cache.
- `lib/ai/pipeline/ids.ts` — UUID generators for `mealItemId` and `ingredientId` (run-scoped). Single helper used by orchestrator after Call 1 parses.
- `lib/ai/pipeline/run-telemetry.ts` — typed builder + writer for `pipeline_runs` rows (replaces ad-hoc `console.info`). Imports `versions.ts` and `db/schema.ts`.
- `lib/ai/pipeline/cooking-method-state.ts` — `COOKING_METHOD_STATE` lookup with `'unknown'` fallback (§2.2 derivation when `expectedState` omitted).
- `lib/ai/pipeline/macro-consistency.ts` — `checkMacroConsistency(ingredient)` returning `{ ok, reason }` for the 4·P+4·C+9·F kcal identity (§1.3).
- `lib/ai/pipeline/density-envelope.ts` — `checkDensityEnvelope(ingredient, grams)` returning `{ ok, breaches }` (§1.4).
- `lib/ai/pipeline/shadow-runner.ts` — best-effort, post-response shadow runner with abort guards (§5.2).
- `lib/ai/pipeline/compute-policy.ts` — `pickComputePolicy(MealFactsForComputePolicy)` pure function with narrow input type (§4.2).
- `lib/ai/pipeline/decomposition-cache.ts` — L4 in-memory LRU cache keyed on `hash(rawInputNormalized + decompositionContextHash + versions)` (§4.3).
- `lib/ai/prompts/types.ts` — `PromptPersonalizationContext = Pick<UserContext, 'countryOfOrigin'|'countryOfResidence'|'cookingHabits'>` (§3.1).
- `scripts/eval-kpis.sql` — manually-run KPI rollup queries over `pipeline_runs` (§5.1).
- `supabase/migrations/<ts>_add_pipeline_runs_table.sql` — Drizzle-generated; `pipeline_runs` table.
- `supabase/migrations/<ts>_pipeline_requests_privacy.sql` — hand-written; 7-day TTL retention + service-role-only RLS on `pipeline_requests` (Decision A).
- `supabase/migrations/<ts>_add_state_to_match_functions.sql` — hand-written; updates `match_ingredients_*` and `fuzzy_match_ingredients_*` SQL to return the existing `state` column (it's already present in the underlying tables; some functions drop it).
- `lib/ai/pipeline/__tests__/versions.test.ts` — guards version-bump invariant (each is a non-empty semver-ish string).
- `lib/ai/pipeline/__tests__/ids.test.ts` — UUID format + uniqueness.
- `lib/ai/pipeline/__tests__/run-telemetry.test.ts` — row-builder shape + privacy hash.
- `lib/ai/pipeline/__tests__/cooking-method-state.test.ts` — lookup + fallback to `'unknown'`.
- `lib/ai/pipeline/__tests__/macro-consistency.test.ts` — kcal identity, low/high channel checks, fiber/alcohol tolerance.
- `lib/ai/pipeline/__tests__/density-envelope.test.ts` — per-macro caps, low ≥ 0, breach flagging.
- `lib/ai/pipeline/__tests__/shadow-runner.test.ts` — sampling determinism, abort guards, post-response timing.
- `lib/ai/pipeline/__tests__/compute-policy.test.ts` — narrow input type, no UserContext access, escalation triggers.
- `lib/ai/pipeline/__tests__/decomposition-cache.test.ts` — context-hash allowlist (no `goal`/`aggression`), version-keyed invalidation.
- `lib/ai/prompts/__tests__/sentinel.test.ts` — sentinel-value tests for `goal`/`aggression`/`cutting`/`bulking` leakage (§3.3).
- `lib/ai/prompts/__tests__/personalization-context.test.ts` — type narrowness (compile-time + runtime structure).

### Modified

- `lib/ai/types.ts` — add `dbState` to `MatchedIngredient`; add `mealItemId`/`ingredientId` to `DecomposedMealItem`/`DecomposedIngredient`; add `ambiguityFlags` (§2.6); change `IngredientLlmNutrition` keying contract (Chunk 3).
- `lib/ai/pipeline/schemas.ts` — add `mealItemId`/`ingredientId` to decomposition Zod schema (Chunk 1); add `expectedState` per-ingredient (Chunk 6); restructure `IngredientLlmNutrition` to single shape with `ingredientId` (Chunk 3); export schema version constants from `versions.ts`.
- `lib/ai/pipeline/assembly.ts` — replace name-keyed `Map`s with id-keyed (Chunk 1); retire `convertCookedToRaw` call (Chunk 3); rewrite `mergeNutrition` to absolute-macro contract (Chunk 3).
- `lib/ai/pipeline/validation.ts` — replace name-keyed lookup; add `density_envelope` and `macro_inconsistent` anomaly types; rewrite `cooked_to_raw_factor_fires` legacy counter (Chunks 1, 3).
- `lib/ai/pipeline/orchestrator.ts` — generate UUIDs after Call 1 parse; emit `ingredientId`/`mealItemId` in SSE events; wire `dbState` through Call 2 prompt context; add `pipeline_runs` row write at end of run; add `compute-policy` decision point (Chunks 1, 5); wire shadow runner (Chunk 4); wire L4 cache (Chunk 5).
- `lib/ai/prompts/decomposition.ts` — accept `PromptPersonalizationContext` (Chunk 2); export `DECOMPOSITION_PROMPT_VERSION` re-export from `versions.ts`; ask for `mealItemId`/`ingredientId` (Chunk 1); ask for `canonicalName`/`expectedState`/`ambiguityFlags` (Chunk 6); document Principle A inline.
- `lib/ai/prompts/nutrition.ts` — accept `PromptPersonalizationContext` (Chunk 2); rewrite `nutrition.ts:138-144` removing preference-shaped framing (Chunk 2); inject `dbState`/`expectedState`/per-100g values per ingredient (Chunk 2 + Chunk 1 plumbing).
- `lib/ai/matching/source-matching.ts` — add `state` to `MatchInfo`; add `state` to `FuzzyMatchRow` projection (already present in raw row); thread through `buildMatchResult` and SQL adapters (Chunk 1).
- `lib/ai/matching/cascade.ts` — propagate `state` from `MatchInfo` into `MatchedIngredient.dbState`; collect both FAO+USDA candidates and apply state-match tie-breaker (Chunk 6); thread `ingredientId` keying.
- `lib/ai/matching/aliases.ts` — add `pre_match_alias_hits` counter increment (Chunk 6).
- `lib/ai/matching/nutrition-batch.ts` — keying by `ingredientId` not name (Chunk 1).
- `lib/ai/constants.ts` — mark `COOKED_TO_RAW_FACTOR` and `convertCookedToRaw` as deprecated; instrument with `cooked_to_raw_factor_fires` increment (Chunk 3).
- `lib/db/schema.ts` — add `pipelineRuns` table (Chunk 1).
- `app/api/meals/analyze/route.ts` (and any other SSE consumers) — accept `ingredientId`/`mealItemId` in event payloads (Chunk 1).

### Verification touchpoints (no edits expected, used in tests)

- `lib/ai/pipeline/goal-adjustment.ts` — already implements the cut/bulk/maintain layer; sentinel tests (Chunk 2) confirm prompts never see these inputs.
- `lib/ai/matching/embedding-cache.ts` — already in-memory FCT vocabulary; reused for `canonicalName` validation (Chunk 6).

---

## Conventions

- **Bun is the runtime.** Use `bun run test`, `bun add`, `bunx @biomejs/biome@2.4.2 check .`. Never `npm`.
- **Lint pinned.** Always `bunx @biomejs/biome@2.4.2 check .` (project pins Biome version).
- **Drizzle two-domain rule.** Schema columns/types/FKs: edit `lib/db/schema.ts`, then `bun db:generate`, then *rename the generated migration* in both filename and `meta/_journal.json` to a meaningful name. RLS/policies/functions/triggers: hand-write a separate timestamped migration in `supabase/migrations/`. Drizzle migrations must be timestamped before manual migrations that reference their columns.
- **Migrations cite extensions.** Any migration using `pgvector` or `pg_trgm` must start with `SET search_path TO public, extensions;`.
- **DB tests need env.** Run with `bun --env-file=.env.local vitest run …` for tests that touch the remote DB.
- **Conventional Commits + Copilot trailer.** Every commit: type prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) and a `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.
- **Frequent commits.** TDD cycle = one commit (failing test → implementation → green → commit).
- **No npm.** `package.json` edits go via `bun add <pkg>`.
- **No long-running commands.** Never run `bun dev`, `bun run build`, `bun start` unless the user asks.

---

## Chunk 1: §0 Foundations

**Spec sections:** §0.1 Stable IDs · §0.2 DB state propagation · §0.3 Prompt/schema versioning · §0.4 `pipeline_runs` table · §0.5 / Decision A — `pipeline_requests` privacy reckoning.

**Why first:** Everything else depends on these. Stable IDs unblock id-keyed retry replacement and dish-wrapping safety. DB state propagation fixes a *current* silent under-counting bug (cooked-row + `convertCookedToRaw` double-application). Versioning is required for L4 cache (Chunk 5) and shadow runner (Chunk 4). The `pipeline_runs` table is the substrate for KPI rollups (Chunk 4) and most downstream telemetry. Decision A closes the privacy story §5 depends on.

**Outcome:** Pipeline runs identically to today on the user-facing surface (no behavioral change), but emits stable IDs end-to-end, threads DB state through matching, writes a row to `pipeline_runs` per run with version constants, and `pipeline_requests` is locked down with TTL + service-role RLS.

---

### Task 1.1: Add prompt/schema version constants

Pure additive module, no behavior change. Used by every later chunk.

**Files:**
- Create: `lib/ai/pipeline/versions.ts`
- Create: `lib/ai/pipeline/__tests__/versions.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ai/pipeline/__tests__/versions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DECOMPOSITION_PROMPT_VERSION,
  DECOMPOSITION_SCHEMA_VERSION,
  NUTRITION_PROMPT_VERSION,
  NUTRITION_SCHEMA_VERSION,
} from '../versions';

describe('pipeline version constants', () => {
  it('exports non-empty semver-shaped strings', () => {
    for (const v of [
      DECOMPOSITION_PROMPT_VERSION,
      DECOMPOSITION_SCHEMA_VERSION,
      NUTRITION_PROMPT_VERSION,
      NUTRITION_SCHEMA_VERSION,
    ]) {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('initial values are 2.0.0 (v2 pipeline + this spec)', () => {
    expect(DECOMPOSITION_PROMPT_VERSION).toBe('2.0.0');
    expect(NUTRITION_PROMPT_VERSION).toBe('2.0.0');
    expect(DECOMPOSITION_SCHEMA_VERSION).toBe('2.0.0');
    expect(NUTRITION_SCHEMA_VERSION).toBe('2.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/versions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`lib/ai/pipeline/versions.ts`:

```ts
/**
 * Single source of truth for prompt and schema versions.
 * Bumping any of these invalidates the L4 cache (see decomposition-cache.ts)
 * and is recorded per run in pipeline_runs.
 *
 * Bump rules:
 * - PATCH: typo fixes, comment changes (no behavior shift)
 * - MINOR: prompt clarification (same contract, behavior may shift slightly)
 * - MAJOR: schema change OR prompt rewrite that changes the LLM's task
 */
export const DECOMPOSITION_PROMPT_VERSION = '2.0.0';
export const NUTRITION_PROMPT_VERSION = '2.0.0';
export const DECOMPOSITION_SCHEMA_VERSION = '2.0.0';
export const NUTRITION_SCHEMA_VERSION = '2.0.0';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test lib/ai/pipeline/__tests__/versions.test.ts`
Expected: PASS (2 tests).

Run: `bunx @biomejs/biome@2.4.2 check lib/ai/pipeline/versions.ts lib/ai/pipeline/__tests__/versions.test.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/pipeline/versions.ts lib/ai/pipeline/__tests__/versions.test.ts
git commit -m "feat(ai/pipeline): add prompt and schema version constants

Single source of truth for DECOMPOSITION_PROMPT_VERSION,
NUTRITION_PROMPT_VERSION, DECOMPOSITION_SCHEMA_VERSION,
NUTRITION_SCHEMA_VERSION. Imported by prompts, schemas, telemetry,
and the L4 decomposition cache (later chunks).

Spec: §0.3 Prompt + schema versioning.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.2: Add `pipelineRuns` Drizzle table

Drizzle schema first (Domain A per AGENTS.md). Generates a migration we'll rename.

**Files:**
- Modify: `lib/db/schema.ts` (append new table)
- Generate: `supabase/migrations/<ts>_add_pipeline_runs_table.sql`
- Modify: `supabase/migrations/meta/_journal.json` (rename tag)

- [ ] **Step 1: Locate the existing schema patterns**

Skim `lib/db/schema.ts` for an existing analytics-style table to mirror (column casing, defaults, `text[]` array usage). Confirm the file uses `pgTable` from `drizzle-orm/pg-core`.

- [ ] **Step 2: Write the failing test**

Create `lib/ai/pipeline/__tests__/run-telemetry-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pipelineRuns } from '@/lib/db/schema';

describe('pipelineRuns Drizzle schema', () => {
  it('exports a Drizzle table with the spec §0.4 columns', () => {
    const cols = Object.keys(pipelineRuns);
    for (const c of [
      'id',
      'createdAt',
      'userIdHash',
      'requestId',
      'decompositionPromptVersion',
      'nutritionPromptVersion',
      'decompositionSchemaVersion',
      'nutritionSchemaVersion',
      'modelCall1',
      'modelCall2',
      'escalated',
      'cacheHitL4',
      'retryCount',
      'decomposeMs',
      'matchMs',
      'nutritionMs',
      'totalMs',
      'ingredientCount',
      'matchedCount',
      'unmatchedCount',
      'anomalyTypes',
      'preMatchAliasHits',
      'cookedToRawFactorFires',
      'densityEnvelopeFires',
      'macroInconsistentFires',
      'dbStateUnknownFires',
      'retryStep2Count',
      'promptPersonalizationFields',
    ]) {
      expect(cols).toContain(c);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/run-telemetry-schema.test.ts`
Expected: FAIL — `pipelineRuns` is not exported.

- [ ] **Step 4: Add the Drizzle table**

In `lib/db/schema.ts`, append (preserving existing imports — make sure `pgTable`, `uuid`, `text`, `timestamp`, `boolean`, `smallint`, `integer` are imported):

```ts
export const pipelineRuns = pgTable('pipeline_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  userIdHash: text('user_id_hash').notNull(),
  requestId: text('request_id'),
  decompositionPromptVersion: text('decomposition_prompt_version').notNull(),
  nutritionPromptVersion: text('nutrition_prompt_version').notNull(),
  decompositionSchemaVersion: text('decomposition_schema_version').notNull(),
  nutritionSchemaVersion: text('nutrition_schema_version').notNull(),
  modelCall1: text('model_call1').notNull(),
  modelCall2: text('model_call2').notNull(),
  escalated: boolean('escalated').notNull().default(false),
  cacheHitL4: boolean('cache_hit_l4').notNull().default(false),
  retryCount: smallint('retry_count').notNull().default(0),
  decomposeMs: integer('decompose_ms').notNull().default(0),
  matchMs: integer('match_ms').notNull().default(0),
  nutritionMs: integer('nutrition_ms').notNull().default(0),
  totalMs: integer('total_ms').notNull().default(0),
  ingredientCount: smallint('ingredient_count').notNull().default(0),
  matchedCount: smallint('matched_count').notNull().default(0),
  unmatchedCount: smallint('unmatched_count').notNull().default(0),
  anomalyTypes: text('anomaly_types').array().notNull().default(sql`'{}'::text[]`),
  preMatchAliasHits: smallint('pre_match_alias_hits').notNull().default(0),
  cookedToRawFactorFires: smallint('cooked_to_raw_factor_fires').notNull().default(0),
  densityEnvelopeFires: smallint('density_envelope_fires').notNull().default(0),
  macroInconsistentFires: smallint('macro_inconsistent_fires').notNull().default(0),
  dbStateUnknownFires: smallint('db_state_unknown_fires').notNull().default(0),
  retryStep2Count: smallint('retry_step2_count').notNull().default(0),
  promptPersonalizationFields: text('prompt_personalization_fields')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
});
```

(If `sql` is not yet imported in `schema.ts`, add `import { sql } from 'drizzle-orm';`.)

- [ ] **Step 5: Generate the migration**

Run: `bun db:generate`
Expected: a new file appears at `supabase/migrations/<ts>_<random_name>.sql` and `supabase/migrations/meta/_journal.json` is updated.

- [ ] **Step 6: Rename the migration to a meaningful name**

Per repo memory: rename both the SQL filename and the corresponding `tag` field in `meta/_journal.json` to `<ts>_add_pipeline_runs_table` (replace `<random_name>`).

- [ ] **Step 7: Inspect and sanity-check the SQL**

Run: `cat supabase/migrations/<ts>_add_pipeline_runs_table.sql`
Expected: a `CREATE TABLE "pipeline_runs"` with all columns and array defaults present. No RLS in this file (we'll add it in Task 1.3 to keep Drizzle and manual migrations separate).

- [ ] **Step 8: Run schema test**

Run: `bun run test lib/ai/pipeline/__tests__/run-telemetry-schema.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/db/schema.ts \
  supabase/migrations/<ts>_add_pipeline_runs_table.sql \
  supabase/migrations/meta/_journal.json \
  lib/ai/pipeline/__tests__/run-telemetry-schema.test.ts
git commit -m "feat(db): add pipeline_runs telemetry table

§0.4 — durable structured telemetry for KPI rollups (§5.1) and shadow
A/B comparison (§5.2). user_id_hash only (no raw user id, no userContext).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.3: RLS + service-role-only access on `pipeline_runs`

Hand-written manual migration (Domain B). Only the service role writes/reads telemetry; never end users.

**Files:**
- Create: `supabase/migrations/<ts+1>_pipeline_runs_rls.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/<ts+1>_pipeline_runs_rls.sql` (timestamp must sort *after* the Drizzle create):

```sql
-- pipeline_runs is system telemetry. Service role only.
SET search_path TO public, extensions;

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon = no access.
-- The service role bypasses RLS by design; that's the only writer/reader.

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at
  ON public.pipeline_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user_id_hash_created_at
  ON public.pipeline_runs (user_id_hash, created_at DESC);
```

- [ ] **Step 2: Verify migration ordering**

Run: `ls -la supabase/migrations/ | tail -10`
Expected: the new RLS file timestamp is strictly after the `add_pipeline_runs_table` file.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<ts+1>_pipeline_runs_rls.sql
git commit -m "feat(db): RLS lockdown + indexes for pipeline_runs

Service-role-only access (no policies for authenticated/anon).
Created descending created_at and (user_id_hash, created_at) indexes
for KPI rollup queries (§5.1).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.4: Decision A — TTL + tighter RLS on existing `pipeline_requests`

Per Decision A (resolved: split debug-from-analytics retention). 7-day TTL via `pg_cron`-style `DELETE`, service-role-only RLS. The existing migration `20260406033451_add_pipeline_requests_table.sql` is the source.

**Files:**
- Create: `supabase/migrations/<ts+2>_pipeline_requests_privacy.sql`
- Modify: `docs/DATABASE.md` (document access controls + TTL)

- [ ] **Step 1: Inspect the current state of `pipeline_requests`**

Run: `cat supabase/migrations/20260406033451_add_pipeline_requests_table.sql`
Read which RLS policies already exist (if any) and which columns are present (we expect `raw_input`, `user_context_json`, `created_at`).

- [ ] **Step 2: Write the privacy migration**

`supabase/migrations/<ts+2>_pipeline_requests_privacy.sql`:

```sql
-- Decision A — split debug-from-analytics retention.
-- pipeline_requests is short-window operational debug only.
-- pipeline_runs is the analytics source.
SET search_path TO public, extensions;

-- Tighten RLS: drop any user-facing policies; service role only.
ALTER TABLE public.pipeline_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.pipeline_requests'::regclass
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.pipeline_requests',
      pol.polname
    );
  END LOOP;
END $$;

-- 7-day TTL retention. Use a cron extension if available; otherwise this
-- migration documents the policy and supplies a manual reaper function.
CREATE OR REPLACE FUNCTION public.reap_pipeline_requests()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.pipeline_requests
  WHERE created_at < (now() - interval '7 days');
$$;

REVOKE ALL ON FUNCTION public.reap_pipeline_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_pipeline_requests() TO service_role;

-- Schedule via pg_cron if available; otherwise call from a daily worker.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'reap-pipeline-requests-daily',
      '17 3 * * *',
      $$SELECT public.reap_pipeline_requests();$$
    );
  END IF;
EXCEPTION WHEN others THEN
  -- pg_cron not granted; daily reap must be invoked externally.
  NULL;
END $$;
```

- [ ] **Step 3: Update docs**

In `docs/DATABASE.md`, add a section:

```md
## pipeline_requests retention (Decision A)

`pipeline_requests` stores raw meal input + `userContextJson` for short-window
operational debugging only. Access is service-role-only (RLS with no policies).
Retention is 7 days enforced by `public.reap_pipeline_requests()`, scheduled
daily via `pg_cron` when the extension is granted; otherwise the function must
be invoked from a daily worker.

`pipeline_runs` (this spec, §0.4) is the analytics source — it stores
`user_id_hash` only, never raw input.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts+2>_pipeline_requests_privacy.sql docs/DATABASE.md
git commit -m "feat(db): pipeline_requests TTL + service-role-only RLS (Decision A)

7-day retention via reap_pipeline_requests() and pg_cron when granted.
RLS policies for authenticated/anon are dropped; only service_role
bypasses RLS. pipeline_runs (§0.4) carries the long-term analytics
data with user_id_hash only.

Spec: Decision A.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.5: Add `state` to `MatchInfo` and propagate through source-matching

Spec §0.2: schema enforces `state IN ('raw','cooked')`, source-aware SQL returns it, but `MatchInfo` drops it. Add it back end-to-end.

**Files:**
- Modify: `lib/ai/matching/source-matching.ts`
- Create: `lib/ai/matching/__tests__/match-info-state.test.ts`

- [ ] **Step 1: Read the existing match-functions migration**

Run: `cat supabase/migrations/20260412143500_add_source_aware_match_functions.sql | head -40`
Confirm the SQL function returns `state` (or `raw_state`) in its row.

- [ ] **Step 2: Write the failing test**

`lib/ai/matching/__tests__/match-info-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMatchResult, type FuzzyMatchRow } from '../source-matching';

describe('MatchInfo carries DB state', () => {
  it('preserves the state field from the matched row', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-1',
        name_primary: 'Cá quả',
        name_alt: null,
        name_en: 'Snakehead fish',
        state: 'raw',
        similarity: 0.9,
      },
    ];
    const info = buildMatchResult('cá lóc', rows, 0.7);
    expect(info).not.toBeNull();
    expect(info?.state).toBe('raw');
  });

  it('handles cooked rows', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-2',
        name_primary: 'Cá kho',
        name_alt: null,
        name_en: 'Braised fish',
        state: 'cooked',
        similarity: 0.92,
      },
    ];
    expect(buildMatchResult('cá kho', rows, 0.7)?.state).toBe('cooked');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/matching/__tests__/match-info-state.test.ts`
Expected: FAIL — `state` does not exist on `MatchInfo`.

- [ ] **Step 4: Add `state` to `MatchInfo`**

In `lib/ai/matching/source-matching.ts`, modify the `MatchInfo` interface (line ~48):

```ts
export interface MatchInfo {
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  /** DB-enforced row state (§0.2). 'unknown' when row pre-dates state column. */
  state: 'raw' | 'cooked' | 'unknown';
}
```

In `buildMatchResult` (line ~71), populate it:

```ts
return {
  ingredientName,
  foodCompositionId: topMatch.id,
  matchedName: topMatch.name_primary,
  similarity: topMatch.similarity,
  confidence: classifyConfidence(topMatch.similarity),
  state:
    topMatch.state === 'raw' || topMatch.state === 'cooked'
      ? topMatch.state
      : 'unknown',
};
```

(Also confirm `FuzzyMatchRow.state` is typed `string` — that's OK because the SQL enforces enum at write time.)

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test lib/ai/matching/__tests__/match-info-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full matching test suite to catch regressions**

Run: `bun --env-file=.env.local vitest run lib/ai/matching/__tests__/`
Expected: existing tests still pass; type-check is clean.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/matching/source-matching.ts \
  lib/ai/matching/__tests__/match-info-state.test.ts
git commit -m "feat(ai/matching): preserve DB state in MatchInfo

Spec §0.2 — schema enforces state IN ('raw','cooked') and source-aware
SQL returns it; MatchInfo previously dropped it. Adds 'unknown' fallback
for rows without state set, which becomes a telemetry signal in
pipeline_runs.db_state_unknown_fires (§0.4).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.6: Verify SQL match functions return `state` and patch any that don't

`source-matching.ts` reads `state` from the SQL row. Confirm every SQL function we call returns it; patch the ones that don't.

**Files:**
- Read-only audit: `supabase/migrations/*_match_functions.sql`, `supabase/migrations/*_fuzzy_match*.sql`
- Maybe create: `supabase/migrations/<ts+3>_match_functions_return_state.sql`

- [ ] **Step 1: Audit existing SQL functions**

Run: `grep -nl 'CREATE.*FUNCTION.*match' supabase/migrations/ | head -20`
For each match-related SQL function, confirm `RETURNS TABLE(...)` includes a `state` column and the `SELECT` projects it.

- [ ] **Step 2: If any function omits `state`, write a fix migration**

If audit finds gaps, create `supabase/migrations/<ts+3>_match_functions_return_state.sql`:

```sql
SET search_path TO public, extensions;

-- Re-CREATE the matching functions to include the state column.
-- (Replace each CREATE OR REPLACE FUNCTION block with the upstream
-- definition plus state in RETURNS TABLE and SELECT.)
-- Example for fuzzy_match_ingredients_by_source:
CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients_by_source(
  query_text text,
  source_id_filter int,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  -- existing body, unchanged except SELECT now lists state
  SELECT
    fc.id,
    fc.name_primary,
    fc.name_alt,
    fc.name_en,
    fc.state,
    similarity(fc.name_primary, query_text)
  FROM public.food_compositions fc
  WHERE fc.source_id = source_id_filter
    AND similarity(fc.name_primary, query_text) >= match_threshold
  ORDER BY similarity(fc.name_primary, query_text) DESC
  LIMIT match_count;
$$;

-- Repeat for any other match-* function the audit found missing state.
```

If audit shows all functions already return `state`, **skip this task — do not create an empty migration**, and document the audit result in the commit message of Task 1.5.

- [ ] **Step 3: If migration was needed, commit it**

```bash
git add supabase/migrations/<ts+3>_match_functions_return_state.sql
git commit -m "fix(db): match SQL functions project state column

Spec §0.2 — MatchInfo carries DB state, requires every match SQL
function (vector + fuzzy, per source) to return it. Audited migrations
found <N> function(s) projecting an incomplete row; this re-creates
them with state included.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.7: Add `dbState` to `MatchedIngredient`

The matching layer's `MatchInfo.state` becomes `MatchedIngredient.dbState` for downstream consumers (Call 2 prompt context, validation, telemetry).

**Files:**
- Modify: `lib/ai/types.ts` (add `dbState`)
- Modify: `lib/ai/matching/cascade.ts` (populate it from `MatchInfo`)
- Create: `lib/ai/matching/__tests__/cascade-db-state.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/ai/matching/__tests__/cascade-db-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { MatchedIngredient } from '@/lib/ai/types';

describe('MatchedIngredient.dbState', () => {
  it("is one of 'raw' | 'cooked' | 'unknown'", () => {
    const sample: MatchedIngredient = {
      ingredientName: 'cá lóc',
      foodCompositionId: 'fc-1',
      matchedName: 'Cá quả',
      similarity: 0.9,
      confidence: 'high',
      nutritionPer100g: {} as MatchedIngredient['nutritionPer100g'],
      dbState: 'raw',
    };
    expect(['raw', 'cooked', 'unknown']).toContain(sample.dbState);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test lib/ai/matching/__tests__/cascade-db-state.test.ts`
Expected: FAIL — TypeScript error: `dbState` does not exist on `MatchedIngredient`.

- [ ] **Step 3: Add `dbState` to the type**

In `lib/ai/types.ts` around line 124, modify `MatchedIngredient`:

```ts
export interface MatchedIngredient {
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  nutritionPer100g: NutritionPer100g;
  /** DB-enforced row state (§0.2). 'unknown' when the row pre-dates the column. */
  dbState: 'raw' | 'cooked' | 'unknown';
}
```

- [ ] **Step 4: Populate `dbState` in cascade.ts**

In `lib/ai/matching/cascade.ts`, find where `MatchedIngredient` objects are built (search for `nutritionPer100g`) and add `dbState: matchInfo.state` (or equivalent local variable name).

- [ ] **Step 5: Run cascade tests + type-check**

Run: `bun --env-file=.env.local vitest run lib/ai/matching/__tests__/`
Expected: PASS, no TS errors.

If the type spreads through `nutrition-batch.ts` or other matching files, plumb `dbState` there too. Run again until clean.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/types.ts lib/ai/matching/cascade.ts \
  lib/ai/matching/nutrition-batch.ts \
  lib/ai/matching/__tests__/cascade-db-state.test.ts
git commit -m "feat(ai/matching): plumb dbState through MatchedIngredient

Spec §0.2 — Call 2 prompt context (next chunk) consumes dbState; today
the matching layer drops it. Adds 'unknown' fallback for legacy rows.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.8: Add stable IDs to decomposition schema

Spec §0.1 — add `mealItemId` and `ingredientId` (UUIDs) to the decomposition output. Generate them runtime-side after Call 1 parse (LLM is asked for them too, but the runtime is authoritative if the LLM omits or duplicates).

**Files:**
- Modify: `lib/ai/pipeline/schemas.ts` (Zod)
- Modify: `lib/ai/types.ts` (TS interfaces)
- Create: `lib/ai/pipeline/ids.ts`
- Create: `lib/ai/pipeline/__tests__/ids.test.ts`

- [ ] **Step 1: Write the failing test for the id generator**

`lib/ai/pipeline/__tests__/ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  generateIngredientId,
  generateMealItemId,
  ensureIdsOnDecomposition,
} from '../ids';

describe('id generators', () => {
  it('generates UUID-shaped strings', () => {
    expect(generateMealItemId()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generateIngredientId()).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('generates unique ids', () => {
    const a = new Set(Array.from({ length: 100 }, generateIngredientId));
    expect(a.size).toBe(100);
  });
});

describe('ensureIdsOnDecomposition', () => {
  it('fills missing ids and de-duplicates collisions', () => {
    const decomp = {
      isFood: true,
      mealSlot: 'lunch' as const,
      mealItems: [
        {
          name: 'phở bò',
          mealItemId: 'shared',
          ingredients: [
            { name: 'bánh phở', estimatedGrams: 200, cookingMethod: 'luộc',
              userFacingUnit: '1 tô', ingredientId: 'dup' },
            { name: 'thịt bò', estimatedGrams: 100, cookingMethod: 'luộc',
              userFacingUnit: '3 lát', ingredientId: 'dup' },
          ],
        },
        {
          name: 'rau sống',
          mealItemId: 'shared',
          ingredients: [
            { name: 'rau quế', estimatedGrams: 20, cookingMethod: null,
              userFacingUnit: null, ingredientId: '' },
          ],
        },
      ],
    };
    const out = ensureIdsOnDecomposition(decomp);
    const itemIds = out.mealItems.map((m) => m.mealItemId);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    const ingIds = out.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(new Set(ingIds).size).toBe(ingIds.length);
    for (const id of [...itemIds, ...ingIds]) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/ids.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generator**

`lib/ai/pipeline/ids.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { MealDecomposition } from '../types';

export const generateMealItemId = (): string => randomUUID();
export const generateIngredientId = (): string => randomUUID();

/**
 * Runtime is authoritative for ids. Even if the LLM emits them, we replace
 * any duplicate or missing id with a fresh UUID. Spec §0.1.
 */
export function ensureIdsOnDecomposition(
  decomp: MealDecomposition
): MealDecomposition {
  const seenItem = new Set<string>();
  const seenIng = new Set<string>();
  return {
    ...decomp,
    mealItems: decomp.mealItems.map((mi) => {
      const id =
        mi.mealItemId && !seenItem.has(mi.mealItemId)
          ? mi.mealItemId
          : generateMealItemId();
      seenItem.add(id);
      return {
        ...mi,
        mealItemId: id,
        ingredients: mi.ingredients.map((ing) => {
          const ingId =
            ing.ingredientId && !seenIng.has(ing.ingredientId)
              ? ing.ingredientId
              : generateIngredientId();
          seenIng.add(ingId);
          return { ...ing, ingredientId: ingId };
        }),
      };
    }),
  };
}
```

- [ ] **Step 4: Add fields to TS types**

In `lib/ai/types.ts`, modify the decomposition interfaces:

```ts
export interface DecomposedIngredient {
  ingredientId: string;            // §0.1 stable id
  name: string;
  estimatedGrams: number;
  cookingMethod: string | null;
  userFacingUnit: string | null;
}

export interface DecomposedMealItem {
  mealItemId: string;              // §0.1 stable id
  name: string;
  ingredients: DecomposedIngredient[];
}
```

- [ ] **Step 5: Add fields to Zod schema**

In `lib/ai/pipeline/schemas.ts`, modify:

```ts
export const decomposedIngredientSchema = z.object({
  ingredientId: z
    .string()
    .uuid()
    .optional()
    .describe('Run-scoped UUID for this ingredient. Runtime fills if missing.'),
  name: z.string()...,
  estimatedGrams: ...,
  cookingMethod: ...,
  userFacingUnit: ...,
});

export const decomposedMealItemSchema = z.object({
  mealItemId: z.string().uuid().optional().describe(
    'Run-scoped UUID for this meal item. Runtime fills if missing.'
  ),
  name: z.string()...,
  ingredients: z.array(decomposedIngredientSchema).min(1)...,
});
```

(Optional in Zod schema → mandatory in the TS interface, because `ensureIdsOnDecomposition` fills the gap.)

- [ ] **Step 6: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/ids.test.ts`
Expected: PASS.

Run: `bun run test lib/ai/pipeline/__tests__/schemas.test.ts`
Expected: PASS (existing tests still tolerate the new optional fields).

- [ ] **Step 7: Commit**

```bash
git add lib/ai/pipeline/ids.ts \
  lib/ai/pipeline/__tests__/ids.test.ts \
  lib/ai/types.ts \
  lib/ai/pipeline/schemas.ts
git commit -m "feat(ai/pipeline): add stable mealItemId/ingredientId

Spec §0.1 — replaces name-keyed maps that overwrite silently when an
ingredient or dish name repeats (common in Vietnamese communal meals
with shared 'nước dùng', 'dầu ăn'). Runtime is authoritative; the LLM
may emit ids but ensureIdsOnDecomposition de-duplicates.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.9: Wire `ensureIdsOnDecomposition` into the orchestrator

**Files:**
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Modify: `lib/ai/pipeline/__tests__/orchestrator.test.ts` (or equivalent integration test)

- [ ] **Step 1: Find the Call 1 parse boundary**

Run: `grep -n 'mealDecompositionSchema\|parseCall1\|decomposition' lib/ai/pipeline/orchestrator.ts | head -20`
Locate where the decomposition is fully parsed (post-Zod validation).

- [ ] **Step 2: Write the failing test**

In `lib/ai/pipeline/__tests__/orchestrator.test.ts` (or a new focused test file), add:

```ts
it('every meal item and ingredient has a UUID after orchestration', async () => {
  // ... build a mock orchestrator run with two meal items containing
  // overlapping ingredient names ("nước dùng" in both).
  const result = await runPipelineForTest(/* ... */);
  const mealIds = result.mealItems.map((m) => /* extract */);
  // Use whatever id field surfaces on the result; if not surfaced yet,
  // assert via spy on the post-decomposition value handed to matching.
  // ...
});
```

(If an orchestrator integration test doesn't exist, write a unit test that calls a small helper around the parse step instead.)

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/orchestrator.test.ts`
Expected: FAIL — ids are missing or duplicated.

- [ ] **Step 4: Wire it in**

In the orchestrator, immediately after the Call 1 result is parsed by `mealDecompositionSchema.parse(...)`, wrap it:

```ts
import { ensureIdsOnDecomposition } from './ids';
// ...
const decomposition = ensureIdsOnDecomposition(
  mealDecompositionSchema.parse(parsedRaw)
);
```

- [ ] **Step 5: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts \
  lib/ai/pipeline/__tests__/orchestrator.test.ts
git commit -m "feat(ai/pipeline): apply ensureIdsOnDecomposition post-Call-1

Runtime fills mealItemId/ingredientId immediately after Call 1 parses.
Subsequent matching, validation, assembly, and SSE events key by id
(later tasks in this chunk).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.10: Replace name-keyed maps in `assembly.ts` with id-keyed

The bug: `assembly.ts:106` keys by `ingredientName`, `assembly.ts:110-115` uses `${ing.name}::${mi.mealItemName}`. With ids available, both become `ingredientId`.

**Files:**
- Modify: `lib/ai/pipeline/assembly.ts`
- Modify: `lib/ai/types.ts` (if `IngredientLlmNutrition` needs `ingredientId` propagation)
- Modify: `lib/ai/pipeline/__tests__/` (assembly tests)

- [ ] **Step 1: Write the failing test**

Create or extend `lib/ai/pipeline/__tests__/assembly.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assembleResult } from '../assembly';

describe('assembleResult — id-keyed lookups', () => {
  it('does not collapse two ingredients sharing a display name across dishes', () => {
    // Two dishes both containing "nước dùng" but with different ids and grams.
    // The current name-keyed assembly silently picks one llm-nutrition record
    // for both. After the fix, each instance gets its own llm-nutrition.
    const decomposition = {
      isFood: true,
      mealSlot: 'dinner' as const,
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            { ingredientId: 'ing-1', name: 'nước dùng',
              estimatedGrams: 300, cookingMethod: 'luộc',
              userFacingUnit: '1 tô' },
          ],
        },
        {
          mealItemId: 'meal-B',
          name: 'bún bò Huế',
          ingredients: [
            { ingredientId: 'ing-2', name: 'nước dùng',
              estimatedGrams: 250, cookingMethod: 'luộc',
              userFacingUnit: '1 tô' },
          ],
        },
      ],
    };
    const nutrition = {
      mealItems: [
        {
          mealItemId: 'meal-A',
          mealItemName: 'phở bò',
          ingredients: [
            { ingredientId: 'ing-1', ingredientName: 'nước dùng',
              caloriesKcal: { low: 50, mid: 60, high: 70 },
              proteinG: { low: 1, mid: 2, high: 3 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 0.5, mid: 1, high: 1.5 } },
          ],
        },
        {
          mealItemId: 'meal-B',
          mealItemName: 'bún bò Huế',
          ingredients: [
            { ingredientId: 'ing-2', ingredientName: 'nước dùng',
              caloriesKcal: { low: 90, mid: 100, high: 110 },
              proteinG: { low: 3, mid: 4, high: 5 },
              carbohydrateG: { low: 4, mid: 5, high: 6 },
              fatG: { low: 1.5, mid: 2, high: 2.5 } },
          ],
        },
      ],
    };
    const result = assembleResult(
      decomposition,
      nutrition,
      [],
      [],
      /* userContext */ {} as any
    );
    expect(result.mealItems[0].boundedNutrition.caloriesKcal?.mid).toBe(60);
    expect(result.mealItems[1].boundedNutrition.caloriesKcal?.mid).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/assembly.test.ts`
Expected: FAIL — name-keyed lookup picks the same record for both instances.

- [ ] **Step 3: Replace name-keyed maps**

In `lib/ai/pipeline/assembly.ts`:

- Replace `const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));` with a map keyed by `ingredientId`. (Caveat: `MatchedIngredient` doesn't carry `ingredientId` yet — propagate it through cascade in step 3a below.)
- Replace the composite `${ing.name}::${mi.mealItemName}` map with a `Map<string, IngredientLlmNutrition>` keyed by `ing.ingredientId`.
- Replace the inner lookups (`matchedLookup.get(ing.name)` → `matchedLookup.get(ing.ingredientId)`; `llmNutritionByKey.get(...)` → `llmNutritionByKey.get(ing.ingredientId)`).

- [ ] **Step 3a: Propagate `ingredientId` from decomposition to MatchedIngredient and IngredientLlmNutrition**

`MatchedIngredient` in `lib/ai/types.ts` needs `ingredientId`. Match builders in `cascade.ts` accept the decomposed ingredient and copy its id onto the match result.

`IngredientLlmNutrition` in `lib/ai/types.ts` and the corresponding Zod schema need `ingredientId` (optional in Zod with runtime fill — but here the runtime sees the ingredient before Call 2 starts, so it's authoritative). Update the Call 2 prompt builder to inject the id alongside the name. (Detailed prompt rewrite happens in Chunk 2; for this task we only thread the id through the data structures.)

- [ ] **Step 4: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/assembly.test.ts`
Expected: PASS.

Run: `bun run test lib/ai/pipeline/__tests__/`
Expected: full pipeline test directory passes.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/pipeline/assembly.ts \
  lib/ai/types.ts \
  lib/ai/pipeline/schemas.ts \
  lib/ai/matching/cascade.ts \
  lib/ai/pipeline/__tests__/assembly.test.ts
git commit -m "fix(ai/pipeline): id-keyed lookups in assembly

Spec §0.1 — Map<ingredientName, ...> overwrites silently when the same
display name appears in two dishes (common with 'nước dùng', 'dầu ăn').
Switches matched and Call-2-nutrition lookups to ingredientId. Threads
ingredientId through MatchedIngredient and IngredientLlmNutrition.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.11: Replace name-keyed lookups in `validation.ts`

Same problem in validation. Same fix: key by `ingredientId`.

**Files:**
- Modify: `lib/ai/pipeline/validation.ts`
- Modify: `lib/ai/pipeline/validation.test.ts`

- [ ] **Step 1: Locate name-keyed lookups**

Run: `grep -n 'ingredientName\|::' lib/ai/pipeline/validation.ts`
Expected: lines around 64-75 use name-keying.

- [ ] **Step 2: Write the failing test**

Add to `lib/ai/pipeline/validation.test.ts` a case where two ingredients share a name across dishes, asserting validation correctly attributes anomalies to the right ingredient (verify by including/excluding distinct anomaly inputs per id).

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/validation.test.ts`
Expected: FAIL.

- [ ] **Step 4: Replace lookups with id-keyed**

In `validation.ts`, replace `ingredient.name` keys with `ingredient.ingredientId`. Anomalies record `ingredientId` instead of `ingredientName` (also update `AnomalyType` payload if it carries the id).

- [ ] **Step 5: Run tests**

Run: `bun run test lib/ai/pipeline/validation.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/validation.ts lib/ai/pipeline/validation.test.ts
git commit -m "fix(ai/pipeline): id-keyed lookups in validation

Spec §0.1 — anomaly attribution now keyed by ingredientId. Prevents
wrong anomaly being raised against the wrong row when two dishes share
an ingredient display name.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.12: Emit `ingredientId` and `mealItemId` in SSE events

`orchestrator.ts:148-154, 262, 313-314, 360` emit `item_name` and `item_macros` SSE events. Add ids to both. Update the SSE consumer types so the client can correlate first-pass and retry-pass macros on the same logical slot (key insight from §4.4).

**Files:**
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Modify: `app/api/meals/analyze/route.ts` (SSE serializer)
- Modify: client consumers (e.g., `hooks/use-meal-analysis.ts` or wherever `item_macros` events are deserialized)

- [ ] **Step 1: Locate SSE emit sites**

Run: `grep -n "item_name\|item_macros" lib/ai/pipeline/orchestrator.ts app/api/meals/`
Note every location where the events are emitted or consumed.

- [ ] **Step 2: Write the failing test**

Add to `lib/ai/pipeline/__tests__/orchestrator-sse.test.ts` (create if absent):

```ts
it('item_name SSE events include mealItemId', async () => {
  const events = await collectSseEvents(/* ... */);
  for (const e of events.filter((x) => x.type === 'item_name')) {
    expect(e.payload.mealItemId).toMatch(/^[0-9a-f-]{36}$/i);
  }
});
it('item_macros SSE events include ingredientId and mealItemId', async () => {
  const events = await collectSseEvents(/* ... */);
  for (const e of events.filter((x) => x.type === 'item_macros')) {
    expect(e.payload.ingredientId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.payload.mealItemId).toMatch(/^[0-9a-f-]{36}$/i);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/orchestrator-sse.test.ts`
Expected: FAIL.

- [ ] **Step 4: Add the ids to event payloads**

In `orchestrator.ts`, every `controller.enqueue(...)` (or equivalent emitter) for `item_name` and `item_macros` carries `mealItemId` and (for macros) `ingredientId`. Type the SSE event union accordingly.

- [ ] **Step 5: Update SSE route serializer**

`app/api/meals/analyze/route.ts`: ensure the JSON payload passes `mealItemId`/`ingredientId` straight through; no schema change needed if it just stringifies the event object.

- [ ] **Step 6: Update client consumer types**

In whatever hook/module deserializes SSE events, extend the type union to include the ids. Replace any existing index-based "overwrite by index" logic with id-based "overwrite by ingredientId" — this is the §4.4 retry-replacement safety claim.

- [ ] **Step 7: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts \
  app/api/meals/analyze/route.ts \
  hooks/use-meal-analysis.ts \
  lib/ai/pipeline/__tests__/orchestrator-sse.test.ts
git commit -m "feat(ai/pipeline): id-keyed SSE events for retry replacement

Spec §0.1 + §4.4 — item_name carries mealItemId; item_macros carries
ingredientId+mealItemId. Client correlates retry-pass nutrition to the
same logical slot even if Call 2 ordering shifts on retry.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.13: `pipeline_runs` row writer + telemetry helper

Pure data-layer wrapper around the table created in Task 1.2 + 1.3. Used by orchestrator at end of each run.

**Files:**
- Create: `lib/ai/pipeline/run-telemetry.ts`
- Create: `lib/ai/pipeline/__tests__/run-telemetry.test.ts`
- Modify: `lib/ai/pipeline/orchestrator.ts` (call the writer at the end of every run, even error paths)

- [ ] **Step 1: Write the failing test**

`lib/ai/pipeline/__tests__/run-telemetry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildPipelineRunRow, hashUserId } from '../run-telemetry';

describe('hashUserId', () => {
  it('returns SHA-256 hex of user id', () => {
    const h = hashUserId('user-123');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is deterministic', () => {
    expect(hashUserId('u')).toBe(hashUserId('u'));
  });
});

describe('buildPipelineRunRow', () => {
  it('captures every spec §0.4 column with safe defaults', () => {
    const row = buildPipelineRunRow({
      userId: 'u-1',
      requestId: 'req-1',
      modelCall1: 'gemini-2.5-flash-lite',
      modelCall2: 'gemini-2.5-flash-lite',
      timings: { decompose: 1200, match: 800, nutrition: 2400, total: 4500 },
      counts: { ingredient: 5, matched: 4, unmatched: 1 },
      anomalyTypes: [],
      counters: {
        preMatchAliasHits: 0,
        cookedToRawFactorFires: 0,
        densityEnvelopeFires: 0,
        macroInconsistentFires: 0,
        dbStateUnknownFires: 0,
        retryStep2Count: 0,
      },
      escalated: false,
      cacheHitL4: false,
      retryCount: 0,
      promptPersonalizationFields: ['countryOfOrigin', 'cookingHabits'],
    });
    expect(row.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.requestId).toBe('req-1');
    expect(row.totalMs).toBe(4500);
    expect(row.promptPersonalizationFields).not.toContain('goal');
  });

  it('rejects payload that includes goal/aggression in promptPersonalizationFields', () => {
    expect(() =>
      buildPipelineRunRow({
        // ...
        promptPersonalizationFields: ['goal'],
      } as any)
    ).toThrow(/goal|aggression/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/run-telemetry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

`lib/ai/pipeline/run-telemetry.ts`:

```ts
import { createHash } from 'node:crypto';
import {
  DECOMPOSITION_PROMPT_VERSION,
  DECOMPOSITION_SCHEMA_VERSION,
  NUTRITION_PROMPT_VERSION,
  NUTRITION_SCHEMA_VERSION,
} from './versions';

export const hashUserId = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

const FORBIDDEN_PERSONALIZATION_FIELDS = new Set([
  'goal',
  'aggression',
  'calorieTarget',
  'macroTargets',
  'bodyMetrics',
  'weightKg',
  'heightCm',
]);

export interface BuildPipelineRunRowInput {
  userId: string;
  requestId: string | null;
  modelCall1: string;
  modelCall2: string;
  timings: {
    decompose: number;
    match: number;
    nutrition: number;
    total: number;
  };
  counts: { ingredient: number; matched: number; unmatched: number };
  anomalyTypes: string[];
  counters: {
    preMatchAliasHits: number;
    cookedToRawFactorFires: number;
    densityEnvelopeFires: number;
    macroInconsistentFires: number;
    dbStateUnknownFires: number;
    retryStep2Count: number;
  };
  escalated: boolean;
  cacheHitL4: boolean;
  retryCount: number;
  promptPersonalizationFields: string[];
}

export function buildPipelineRunRow(input: BuildPipelineRunRowInput) {
  for (const f of input.promptPersonalizationFields) {
    if (FORBIDDEN_PERSONALIZATION_FIELDS.has(f)) {
      throw new Error(
        `Principle A violation: '${f}' must not appear in prompts. ` +
          'Goal-preference application is goal-adjustment.ts territory.'
      );
    }
  }
  return {
    userIdHash: hashUserId(input.userId),
    requestId: input.requestId,
    decompositionPromptVersion: DECOMPOSITION_PROMPT_VERSION,
    nutritionPromptVersion: NUTRITION_PROMPT_VERSION,
    decompositionSchemaVersion: DECOMPOSITION_SCHEMA_VERSION,
    nutritionSchemaVersion: NUTRITION_SCHEMA_VERSION,
    modelCall1: input.modelCall1,
    modelCall2: input.modelCall2,
    escalated: input.escalated,
    cacheHitL4: input.cacheHitL4,
    retryCount: input.retryCount,
    decomposeMs: input.timings.decompose,
    matchMs: input.timings.match,
    nutritionMs: input.timings.nutrition,
    totalMs: input.timings.total,
    ingredientCount: input.counts.ingredient,
    matchedCount: input.counts.matched,
    unmatchedCount: input.counts.unmatched,
    anomalyTypes: input.anomalyTypes,
    preMatchAliasHits: input.counters.preMatchAliasHits,
    cookedToRawFactorFires: input.counters.cookedToRawFactorFires,
    densityEnvelopeFires: input.counters.densityEnvelopeFires,
    macroInconsistentFires: input.counters.macroInconsistentFires,
    dbStateUnknownFires: input.counters.dbStateUnknownFires,
    retryStep2Count: input.counters.retryStep2Count,
    promptPersonalizationFields: input.promptPersonalizationFields,
  };
}

export async function writePipelineRun(
  db: import('@/lib/db').AppDb,
  row: ReturnType<typeof buildPipelineRunRow>
): Promise<void> {
  const { pipelineRuns } = await import('@/lib/db/schema');
  await db.insert(pipelineRuns).values(row);
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/run-telemetry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into the orchestrator**

In `lib/ai/pipeline/orchestrator.ts`, at the end of every run path (success and recoverable error):

```ts
try {
  const row = buildPipelineRunRow({
    userId,
    requestId,
    modelCall1: DECOMPOSITION_MODEL,
    modelCall2: pickedCall2Model,
    timings,
    counts: { ingredient, matched, unmatched },
    anomalyTypes,
    counters,
    escalated,
    cacheHitL4,
    retryCount,
    promptPersonalizationFields: usedFields,
  });
  await writePipelineRun(db, row);
} catch (err) {
  console.error('[ai/pipeline] failed to write pipeline_runs row', err);
}
```

(Telemetry writes never block the response and never throw out of the orchestrator.)

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/run-telemetry.ts \
  lib/ai/pipeline/__tests__/run-telemetry.test.ts \
  lib/ai/pipeline/orchestrator.ts
git commit -m "feat(ai/pipeline): write pipeline_runs telemetry per run

Spec §0.4 — replaces console.info metrics with structured rows.
buildPipelineRunRow refuses 'goal'/'aggression'/etc in
promptPersonalizationFields (Principle A guardrail).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.14: Lint + full test sweep for Chunk 1

**Files:** none new

- [ ] **Step 1: Lint**

Run: `bunx @biomejs/biome@2.4.2 check .`
Expected: 0 errors. Fix any new findings introduced by this chunk.

- [ ] **Step 2: Test**

Run: `bun --env-file=.env.local vitest run`
Expected: full suite green. (Tests that touch the remote DB need the env file; non-DB tests would also pass without it but using the env file keeps everything consistent.)

- [ ] **Step 3: Sanity-check the migrations are well-ordered**

Run: `ls supabase/migrations/ | sort | tail -10`
Confirm the order is:
1. `<orig>_add_pipeline_requests_table.sql`
2. `<this chunk>_add_pipeline_runs_table.sql`
3. `<this chunk>_pipeline_runs_rls.sql`
4. `<this chunk>_pipeline_requests_privacy.sql`
5. (optional) `<this chunk>_match_functions_return_state.sql`

- [ ] **Step 4: No commit (verification only)**

If everything is green, Chunk 1 is complete. Open a draft PR or proceed to Chunk 2.

---

### Chunk 1 — outcome verification

After Chunk 1 ships, the system should:

- Write a `pipeline_runs` row per run with the version constants populated.
- Emit `mealItemId` and `ingredientId` in every SSE `item_name`/`item_macros` event.
- Carry `dbState` from the matching layer to the `MatchedIngredient` (consumed by Chunk 2).
- Have `pipeline_requests` retention reduced to 7 days with service-role-only RLS.
- Pass all sentinel-friendly tests (Chunk 2 sentinel tests build on the personalization-field telemetry from this chunk).

**No user-facing behavior change is expected.** The only observable difference for end users is that retry-pass nutrition now overwrites by id, which fixes a latent retry-replacement bug but is not visible until §4.4-style retries fire.

---
