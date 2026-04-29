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
- `supabase/migrations/<ts>_match_functions_return_state.sql` — hand-written; updates `match_ingredients_*` and `fuzzy_match_ingredients_*` SQL to return the existing `state` column (it's already present in the underlying tables; some functions drop it).
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
- `app/api/analyze-meal/route.ts` (and any other SSE consumers) — accept `ingredientId`/`mealItemId` in event payloads (Chunk 1).

### Verification touchpoints (no edits expected, used in tests)

- `lib/ai/pipeline/goal-adjustment.ts` — already implements the cut/bulk/maintain layer; sentinel tests (Chunk 2) confirm prompts never see these inputs.
- `lib/ai/matching/embedding-cache.ts` — already in-memory FCT vocabulary; reused for `canonicalName` validation (Chunk 6).

---

## Conventions

- **Bun is the runtime.** Use `bun run test`, `bun add`, `bunx @biomejs/biome@2.4.2 check .`. Never `npm`.
- **Lint pinned.** Always `bunx @biomejs/biome@2.4.2 check .` (project pins Biome version).
- **Drizzle two-domain rule.** Schema columns/types/FKs: edit `lib/db/schema.ts`, then `bun db:generate`, then *rename the generated migration* in both filename and `meta/_journal.json` to a meaningful name. RLS/policies/functions/triggers: hand-write a separate timestamped migration in `supabase/migrations/`. Drizzle migrations must be timestamped before manual migrations that reference their columns.
- **Migration timestamps are concrete.** Whenever a task says `<ts>`, `<ts+1>`, etc., produce the value at task time with `date -u +%Y%m%d%H%M%S`. Each subsequent migration's prefix must strictly exceed the previous one's (advance the seconds field manually if you generate two within the same second). Use these concrete prefixes in both the filename and the `meta/_journal.json` `tag` field.
- **Migrations cite extensions.** Any migration using `pgvector` or `pg_trgm` must start with `SET search_path TO public, extensions;`.
- **DB tests need env.** Run with `bun --env-file=.env.local vitest run …` for tests that touch the remote DB.
- **Conventional Commits + Copilot trailer.** Every commit: type prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) and a `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.
- **Frequent commits.** TDD cycle = one commit (failing test → implementation → green → commit).
- **No npm.** `package.json` edits go via `bun add <pkg>`.
- **No long-running commands.** Never run `bun dev`, `bun run build`, `bun start` unless the user asks.

---

## Chunk 1a: §0 Foundations — Part A (versioning, telemetry table, privacy)

**Spec sections:** §0.3 Prompt/schema versioning · §0.4 `pipeline_runs` table · §0.5 / Decision A — `pipeline_requests` privacy reckoning.

**Why first:** Pure additive infra with no behavior coupling. Versioning constants are required by the L4 cache (Chunk 5) and shadow runner (Chunk 4). The `pipeline_runs` table is the substrate for KPI rollups (Chunk 4). Decision A closes the privacy story §5 depends on.

**Outcome:** New version constants exported; new `pipeline_runs` table with RLS; `pipeline_requests` locked down with TTL + service-role RLS; no orchestrator behavior change.

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

**Why `prompt_personalization_fields` lives on this table:** It's the audit column for Principle A. We record which user-context fields were actually rendered into Call 1 / Call 2 prompts (e.g. `['countryOfOrigin','cookingHabits']`). The telemetry helper in Task 1.13 will reject any row whose value contains forbidden fields (`goal`, `aggression`, `calorieTarget`, …), making Principle A a hard guardrail rather than a code-review convention. Storing it on `pipeline_runs` means the guarantee survives even if upstream code is refactored.

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

(Verify the imports at the top of `schema.ts` include all of: `pgTable`, `uuid`, `text`, `timestamp`, `boolean`, `smallint`, `integer`, plus `sql` from `drizzle-orm`. Add anything missing — `smallint`/`integer`/`sql` are likely not yet imported.)

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
EXCEPTION
  WHEN insufficient_privilege OR undefined_function OR undefined_table THEN
    -- pg_cron exists but cron schema not granted to this role, or
    -- cron.schedule signature differs. Daily reap must be invoked
    -- externally. Any other exception class re-raises so we don't
    -- silently swallow real schema errors.
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

### Chunk 1a — outcome verification

After Chunk 1a ships:

- [ ] `lib/ai/pipeline/versions.ts` exports the four version constants.
- [ ] `pipelineRuns` table exists with all §0.4 columns and service-role-only RLS.
- [ ] `pipeline_requests` has 7-day TTL via `reap_pipeline_requests()` and no user-facing RLS policies.
- [ ] `bunx @biomejs/biome@2.4.2 check .` passes.
- [ ] `bun run test lib/ai/pipeline/__tests__/run-telemetry-schema.test.ts` passes.

No orchestrator behavior change. The orchestrator does not yet write to `pipeline_runs` — that wiring lands in Chunk 1b once the row writer exists.

---

## Chunk 1b: §0 Foundations — Part B (DB state propagation)

**Spec sections:** §0.2 DB state propagation.

**Why next:** Fixes a *current* silent under-counting bug — the schema enforces `state IN ('raw','cooked')` but `MatchInfo` drops it, so `convertCookedToRaw` may double-discount cooked rows. Threading `state` through `MatchInfo → MatchedIngredient.dbState` is a precondition for Chunk 2 (Call 2 prompt context references `dbState`) and Chunk 3 (retiring `convertCookedToRaw` with instrumented fallback).

**Outcome:** Every match pathway projects `state`; `MatchInfo.state` and `MatchedIngredient.dbState` are populated end-to-end with `'raw' | 'cooked' | 'unknown'`. No orchestrator behavior change yet — `dbState` is consumed in Chunk 2 (prompt) and Chunk 3 (raw/cooked logic).

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

### Task 1.6: Audit + (conditional) patch SQL match functions to project `state`

`source-matching.ts` reads `state` from the SQL row. Confirm every SQL function we call returns it. This task is **audit-driven**: produce an inventory first, then either ship a fix migration with concrete `CREATE OR REPLACE FUNCTION` blocks or close the task with no migration if the audit shows no gaps.

**Files:**
- Read-only audit: `supabase/migrations/*.sql` (any file matching match function definitions)
- Conditional create: `supabase/migrations/<ts>_match_functions_return_state.sql` (only if audit finds gaps)

- [ ] **Step 1: Enumerate match SQL functions**

```bash
grep -rEn 'CREATE (OR REPLACE )?FUNCTION public\.(fuzzy_match|match_)' supabase/migrations/ \
  | awk -F: '{print $1}' | sort -u
```

For each function the grep returns, run:

```bash
grep -A 40 'CREATE OR REPLACE FUNCTION public\.<fn_name>' <file>
```

and inspect the `RETURNS TABLE(...)` declaration plus the final `SELECT`. Record the result in a small table in a scratch buffer:

| function | file | RETURNS includes `state`? | SELECT projects `state`? |

- [ ] **Step 2: Decide branch**

  - **Branch A (no gaps):** All match functions already return `state`. Skip Steps 3–5 entirely. Proceed to Step 6 (close-out commit message).
  - **Branch B (gaps found):** Continue with Steps 3–5 and write the migration.

- [ ] **Step 3 (Branch B only): Generate migration**

Create `supabase/migrations/<ts>_match_functions_return_state.sql`. For **each** function the audit flagged in Step 1, paste its current full body (from the source migration file) and add `state text` to the `RETURNS TABLE` and `fc.state` to the `SELECT` projection. Do **not** alter the WHERE/ORDER/LIMIT clauses — this migration is purely projection-additive.

Skeleton (replace `<fn_name>` and `<args>` per function; copy the existing body verbatim except for the two additions):

```sql
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.<fn_name>(<args>)
RETURNS TABLE (
  -- existing columns, in existing order
  id uuid,
  name_primary text,
  name_alt text[],
  name_en text,
  -- ADDED: §0.2 requires state in MatchInfo
  state text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fc.id,
    fc.name_primary,
    fc.name_alt,
    fc.name_en,
    -- ADDED:
    fc.state,
    -- ... rest of existing SELECT ...
    similarity(fc.name_primary, query_text)
  FROM public.food_compositions fc
  -- ... existing WHERE/ORDER/LIMIT, unchanged ...
  ;
$$;
```

- [ ] **Step 4 (Branch B only): Apply locally + run cascade tests**

```bash
bun db:migrate
bun --env-file=.env.local vitest run lib/db/__tests__/
```

Expected: PASS. If a row mapper now sees `state: undefined`, that means the SQL still doesn't project it — re-check Step 3.

- [ ] **Step 5 (Branch B only): Commit fix migration**

```bash
git add supabase/migrations/<ts>_match_functions_return_state.sql
git commit -m "fix(db): match SQL functions project state column

Spec §0.2 — MatchInfo carries DB state. Audit found <list of fn names>
projecting an incomplete row; this re-creates them with state in
RETURNS TABLE and SELECT. Body otherwise unchanged.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 6: Record audit result**

If Branch A: append a one-line note to the Task 1.5 commit body (or, if 1.5 is already pushed, add an empty commit):

```bash
git commit --allow-empty -m "chore(db): audit confirms all match SQL functions project state

Spec §0.2 audit per Task 1.6. Functions inspected:
- fuzzy_match_ingredients_by_source
- match_ingredients_by_source
- (etc.)
All RETURNS TABLE declarations and SELECT projections include state.
No fix migration required.

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

### Chunk 1b — outcome verification

After Chunk 1b ships:

- [ ] `MatchInfo` (in `lib/ai/matching/source-matching.ts`) carries `state: 'raw' | 'cooked' | 'unknown'`.
- [ ] `MatchedIngredient` (in `lib/ai/types.ts`) carries `dbState`.
- [ ] All match SQL functions project `state` (audit logged in commit history).
- [ ] `bun --env-file=.env.local vitest run lib/ai/matching/__tests__/` passes.
- [ ] No orchestrator behavior change (the prompt rewrite that consumes `dbState` is Chunk 2; the `convertCookedToRaw` retirement is Chunk 3).

---

## Chunk 1c: §0 Foundations — Part C (stable IDs + id-keyed lookups + SSE)

**Spec sections:** §0.1 Stable IDs.

**Why third in §0:** All the data-shape additions (Zod, TS, matching, SSE) depend on the version constants from Chunk 1a and on `dbState` being plumbed through matching from Chunk 1b. This chunk switches every name-keyed lookup in `assembly.ts`/`validation.ts` to id-keyed and threads ids through SSE for retry replacement (§4.4). The `pipeline_runs` row writer that consumes the version constants lands in Chunk 1d.

**Outcome:** Stable ids flow from Call 1 parse → matching → Call 2 → assembly → SSE → client. Fixes a current silent retry-corruption bug (name-keyed maps collapse repeated ingredient names across dishes). No user-visible behavior change today; the fixes prevent latent corruption that would surface under retry or dish-wrapping (later chunks).

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
- Create: `lib/ai/pipeline/__tests__/ensure-ids-wiring.test.ts` (unit-level test against the helper applied at the parse boundary)

- [ ] **Step 1: Find the Call 1 parse boundary**

Run: `grep -n 'mealDecompositionSchema\|parseCall1\|decomposition' lib/ai/pipeline/orchestrator.ts | head -20`
Locate the line where `mealDecompositionSchema.parse(...)` (or the equivalent `safeParse(...).data`) is called on the raw Call 1 result. Capture the local variable name (the typed decomposition).

- [ ] **Step 2: Write the failing unit test**

Create `lib/ai/pipeline/__tests__/ensure-ids-wiring.test.ts`. This is a focused unit test on the parse-boundary contract: given a raw decomposition with overlapping ingredient names and no ids, the wired pipeline produces an output where every meal item and every ingredient has a unique UUID.

```ts
import { describe, expect, it } from 'vitest';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/schemas';
import { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/ids';

const RAW_CALL_1_OUTPUT = {
  isFood: true,
  mealSlot: 'dinner',
  mealItems: [
    {
      name: 'phở bò',
      ingredients: [
        { name: 'nước dùng', estimatedGrams: 300, cookingMethod: 'luộc',
          userFacingUnit: '1 tô' },
        { name: 'bánh phở', estimatedGrams: 180, cookingMethod: 'luộc',
          userFacingUnit: '1 tô' },
      ],
    },
    {
      name: 'bún bò Huế',
      ingredients: [
        { name: 'nước dùng', estimatedGrams: 280, cookingMethod: 'luộc',
          userFacingUnit: '1 tô' },
        { name: 'bún', estimatedGrams: 200, cookingMethod: 'luộc',
          userFacingUnit: '1 tô' },
      ],
    },
  ],
};

describe('ensureIdsOnDecomposition at the Call 1 parse boundary', () => {
  it('assigns a unique UUID to every meal item and ingredient', () => {
    // Simulate the parse-boundary call as the orchestrator will:
    const parsed = mealDecompositionSchema.parse(RAW_CALL_1_OUTPUT);
    const filled = ensureIdsOnDecomposition(parsed);

    const mealIds = filled.mealItems.map((m) => m.mealItemId);
    expect(new Set(mealIds).size).toBe(mealIds.length);
    for (const id of mealIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }

    const ingredientIds = filled.mealItems.flatMap((m) =>
      m.ingredients.map((i) => i.ingredientId)
    );
    expect(new Set(ingredientIds).size).toBe(ingredientIds.length);
    for (const id of ingredientIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }

    // Two ingredients sharing the display name "nước dùng" must have
    // distinct ids (the bug §0.1 prevents).
    const nuocDungIds = filled.mealItems
      .flatMap((m) => m.ingredients)
      .filter((i) => i.name === 'nước dùng')
      .map((i) => i.ingredientId);
    expect(nuocDungIds.length).toBe(2);
    expect(nuocDungIds[0]).not.toBe(nuocDungIds[1]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/ensure-ids-wiring.test.ts`
Expected: FAIL — `ingredientId`/`mealItemId` is `undefined` (Zod schema marks them optional from Task 1.8) and `ensureIdsOnDecomposition` is not yet imported by the production parse path. The test's expectations on UUID presence will fail until the helper is wired in.

(If the test instead errors at `ensureIdsOnDecomposition` not being exported, complete Task 1.8 first — this task assumes 1.8 is green.)

- [ ] **Step 4: Wire the helper into the orchestrator parse boundary**

In `lib/ai/pipeline/orchestrator.ts`, immediately after the Call 1 result is parsed by `mealDecompositionSchema.parse(...)` (or `.safeParse(...).data`), wrap it:

```ts
import { ensureIdsOnDecomposition } from './ids';
// ...
const decomposition = ensureIdsOnDecomposition(
  mealDecompositionSchema.parse(parsedRaw)
);
```

All downstream code in the orchestrator now reads `decomposition.mealItems[i].mealItemId` and `decomposition.mealItems[i].ingredients[j].ingredientId`.

- [ ] **Step 5: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/`
Expected: PASS — both the new wiring test and any existing orchestrator tests (which don't yet read ids).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts \
  lib/ai/pipeline/__tests__/ensure-ids-wiring.test.ts
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

- [ ] **Step 3a: Propagate `ingredientId` from decomposition to MatchedIngredient and IngredientLlmNutrition (additive only)**

`MatchedIngredient` in `lib/ai/types.ts` needs `ingredientId`. Match builders in `cascade.ts` accept the decomposed ingredient and copy its id onto the match result.

`IngredientLlmNutrition` in `lib/ai/types.ts` and the corresponding Zod schema need `ingredientId`. **Scope guardrail:** in this chunk we only *add* the `ingredientId` field. The full `IngredientLlmNutrition` contract restructure (renaming, removing `ingredientName`, the absolute-macro shape change) is owned by **Chunk 3**. Do not change keying, naming, or required fields here.

**How the runtime fills `ingredientId`** (Chunk 2 still owns the prompt rewrite, so in this chunk Call 2 results still arrive keyed only by `ingredientName`):

- Make `ingredientId` `z.string().uuid().optional()` in the Zod schema for now (Chunk 3 will tighten this to required and remove `ingredientName`).
- In the Call 2 caller (the function in `lib/ai/pipeline/` that invokes `generateObject` for nutrition — `nutrition.ts` per the spec citation `nutrition.ts:138-144`), after the response parses, reconcile by name lookup against the matched-ingredient list passed into the call. For each result, find the matching `MatchedIngredient` by `ingredientName` and copy its `ingredientId` onto the result. If a name appears in two matched ingredients (the very collision §0.1 fixes), throw with a clear error pointing at this code site — that is the bug we are surfacing, and it must not silently fall back to first-match. The thrown error is acceptable for this chunk because Chunk 2 will switch the prompt to emit ids directly, eliminating the reconciliation path entirely.
- Add a unit test in `lib/ai/pipeline/__tests__/nutrition-reconcile.test.ts` covering: (a) happy path — name matches one matched ingredient, id is copied; (b) collision path — two matched ingredients with the same name throws; (c) no-match path — Call 2 returned a name that is not in the matched list throws.

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

Add to `lib/ai/pipeline/validation.test.ts` (create the file if it doesn't exist; mirror imports of any existing colocated test):

```ts
import { describe, expect, it } from 'vitest';
import { validateNutritionResult } from '@/lib/ai/pipeline/validation';

describe('validation — id-keyed anomaly attribution', () => {
  it('attributes anomalies to the correct ingredient when two share a display name', () => {
    const decomposition = {
      isFood: true as const,
      mealSlot: 'dinner' as const,
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          name: 'bún bò Huế',
          ingredients: [
            {
              ingredientId: 'ing-2',
              name: 'nước dùng',
              estimatedGrams: 280,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };
    // Only ing-2's macros are implausibly high — anomaly must be raised
    // against ing-2 only, not ing-1.
    const llmNutrition = {
      mealItems: [
        {
          mealItemId: 'meal-A',
          mealItemName: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 50, mid: 60, high: 70 },
              proteinG: { low: 1, mid: 2, high: 3 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 0.5, mid: 1, high: 1.5 },
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          mealItemName: 'bún bò Huế',
          ingredients: [
            {
              ingredientId: 'ing-2',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 9000, mid: 9500, high: 10000 },
              proteinG: { low: 1, mid: 2, high: 3 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 0.5, mid: 1, high: 1.5 },
            },
          ],
        },
      ],
    };

    const result = validateNutritionResult(decomposition, llmNutrition);
    const anomalyIds = result.anomalies.map((a) => a.ingredientId);
    expect(anomalyIds).toContain('ing-2');
    expect(anomalyIds).not.toContain('ing-1');
  });
});
```

(If `validateNutritionResult` exposes a different return shape — e.g. anomalies expressed as `{ ingredientName }` today — the test will fail at the assertion, which is the point: this drives the field rename to `ingredientId` in Step 4.)

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
- Modify: `app/api/analyze-meal/route.ts` (SSE serializer)
- Modify: client consumers (enumerated in Step 0 below)

- [ ] **Step 0: Enumerate every SSE consumer in the repo**

```bash
grep -rEn "item_name|item_macros|sse|EventSource|ReadableStream" \
  app/ hooks/ components/ lib/ \
  | grep -viE "(test|spec|\.snap)" \
  | sort
```

Build the concrete list of files this task must update. Common candidates (verified against repo at plan write-time):
- `app/api/analyze-meal/route.ts` (SSE writer)
- `hooks/use-stream-analysis.ts` (SSE event consumer; deserializes the stream into typed events)
- `hooks/use-analyze-meal.ts` (mutation wrapper; usually only needs type updates if it re-exports event types)
- A component under `components/` that consumes the hook (only if it indexes events by name/order — find via grep)

Update the **Files** list at the top of this task with the concrete paths discovered. If the grep returns no client-side consumer, that means SSE deserialization happens inline in a page component — record that path instead. **Do not proceed to Step 1 until the file list is concrete.**

- [ ] **Step 1: Locate SSE emit sites**

Run: `grep -n "item_name\|item_macros" lib/ai/pipeline/orchestrator.ts app/api/analyze-meal/`
Note every location where the events are emitted or consumed.

- [ ] **Step 2: Write the failing test**

Add to `lib/ai/pipeline/__tests__/orchestrator-sse.test.ts` (create if absent). Drive `runPipeline` directly with a minimal in-memory event collector — no HTTP layer needed:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from '@/lib/ai/pipeline/orchestrator';
// Reuse existing mock helpers (see lib/ai/__tests__/test-helpers.ts) for
// google-genai + matching mocks. The point is: collect every onEvent payload
// and assert the SSE invariants on it.

it('item_name SSE events include mealItemId', async () => {
  const events: Array<{ type: string; payload: any }> = [];
  await runPipeline({
    text: 'Một tô phở bò và rau muống xào',
    userContext: /* fixture */ {} as any,
    onEvent: (e) => events.push(e),
  });
  const names = events.filter((x) => x.type === 'item_name');
  expect(names.length).toBeGreaterThan(0);
  for (const e of names) {
    expect(e.payload.mealItemId).toMatch(/^[0-9a-f-]{36}$/i);
  }
});

it('item_macros SSE events include ingredientId and mealItemId', async () => {
  const events: Array<{ type: string; payload: any }> = [];
  await runPipeline({
    text: 'Một tô phở bò và rau muống xào',
    userContext: /* fixture */ {} as any,
    onEvent: (e) => events.push(e),
  });
  const macros = events.filter((x) => x.type === 'item_macros');
  expect(macros.length).toBeGreaterThan(0);
  for (const e of macros) {
    expect(e.payload.ingredientId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(e.payload.mealItemId).toMatch(/^[0-9a-f-]{36}$/i);
  }
});

it('item_name and item_macros for the same logical slot share mealItemId', async () => {
  const events: Array<{ type: string; payload: any }> = [];
  await runPipeline({
    text: 'Một tô phở bò',
    userContext: /* fixture */ {} as any,
    onEvent: (e) => events.push(e),
  });
  const nameIds = new Set(
    events.filter((x) => x.type === 'item_name').map((e) => e.payload.mealItemId),
  );
  const macroIds = new Set(
    events.filter((x) => x.type === 'item_macros').map((e) => e.payload.mealItemId),
  );
  // Every macro mealItemId must have appeared as an item_name first.
  for (const id of macroIds) {
    expect(nameIds.has(id)).toBe(true);
  }
});
```

The third test is the critical one — it enforces that streaming-emitted `item_name` ids match post-parse `item_macros` ids. Step 4 below specifies how to make that hold.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test lib/ai/pipeline/__tests__/orchestrator-sse.test.ts`
Expected: FAIL.

- [ ] **Step 4: Add the ids to event payloads — and resolve the streaming-vs-post-parse ordering gap**

The orchestrator emits `item_name` from inside the `composedOnChunk` streaming callback (via `extractMealItemNames(accumulated, …)`) **before** Call 1 parsing finishes — so before `ensureIdsOnDecomposition` (Task 1.9) has assigned `mealItemId`. The fix:

1. Maintain a `Map<string /* mealItemName */, string /* mealItemId */>` inside the orchestrator scope, populated lazily by the streaming callback. When `extractMealItemNames` yields a new name, mint a fresh UUID, store it in the map, and emit `item_name` with that id.
2. After the Call 1 stream completes and the JSON is parsed, **before** invoking `ensureIdsOnDecomposition`, walk the parsed `mealItems` and copy ids from the streaming map by `mealItemName` (exact match). Only items whose name was not seen during streaming (rare — JSON-parse-only tail) will reach `ensureIdsOnDecomposition` without an id and get one minted there.
3. `ensureIdsOnDecomposition` MUST preserve any pre-existing `mealItemId` (already its contract per Task 1.9). Add a unit test confirming it does not regenerate ids on items that already have one.

This guarantees the third assertion in Step 2 (`item_name` ids ⊇ `item_macros` ids).

Then, in `orchestrator.ts`, every `controller.enqueue(...)` (or equivalent emitter) for `item_name` and `item_macros` carries `mealItemId` and (for macros) `ingredientId`. Type the SSE event union accordingly.

- [ ] **Step 5: Update SSE route serializer**

`app/api/analyze-meal/route.ts`: ensure the JSON payload passes `mealItemId`/`ingredientId` straight through; no schema change needed if it just stringifies the event object.

- [ ] **Step 6: Update client consumer types**

In whatever hook/module deserializes SSE events, extend the type union to include the ids. Replace any existing index-based "overwrite by index" logic with id-based "overwrite by ingredientId" — this is the §4.4 retry-replacement safety claim.

- [ ] **Step 7: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts \
  app/api/analyze-meal/route.ts \
  <client SSE consumer files from Step 0> \
  lib/ai/pipeline/__tests__/orchestrator-sse.test.ts
git commit -m "feat(ai/pipeline): id-keyed SSE events for retry replacement

Spec §0.1 + §4.4 — item_name carries mealItemId; item_macros carries
ingredientId+mealItemId. Client correlates retry-pass nutrition to the
same logical slot even if Call 2 ordering shifts on retry.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Chunk 1c — outcome verification

After Chunk 1c ships:

- [ ] Decomposition Zod schema requires `mealItemId` and `ingredientId` (uuid).
- [ ] `ensureIdsOnDecomposition` mints ids for legacy/missing rows and is idempotent.
- [ ] `assembly.ts` and `validation.ts` use id-keyed lookups; no `Map<ingredientName, ...>` collisions.
- [ ] SSE `item_name` and `item_macros` events carry `mealItemId` (and `ingredientId` for macros).
- [ ] Streaming `item_name` ids match post-parse `item_macros` ids for the same meal item.
- [ ] `IngredientLlmNutrition` carries optional `ingredientId` (Chunk 3 will tighten).
- [ ] `bun run test lib/ai/pipeline/__tests__/` passes.

The `pipeline_runs` row writer and Chunk 1 final sweep land in Chunk 1d.

---

## Chunk 1d: §0 Foundations — Part D (telemetry writer + final sweep)

**Spec sections:** §0.4 row writer wiring · final §0 verification.

**Why split out:** Tasks 1.13 and 1.14 close §0 by writing the telemetry row at orchestrator end and running the full lint/test sweep. They're cleanly separable from the id-plumbing in 1c — and splitting keeps every chunk under the 1000-line cap.

**Outcome:** `pipeline_runs` row is written per orchestrator run (success or error path) with the Principle A guardrail enforced at the writer boundary. Full lint + test suite green for the entire §0 Foundations block (Chunks 1a + 1b + 1c + 1d).

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
        userId: 'u-1',
        requestId: 'req-1',
        modelCall1: 'gemini-2.5-flash-lite',
        modelCall2: 'gemini-2.5-flash-lite',
        timings: { decompose: 1, match: 1, nutrition: 1, total: 3 },
        counts: { ingredient: 1, matched: 1, unmatched: 0 },
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
        promptPersonalizationFields: ['goal'],
      })
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

### Task 1.14: Lint + full test sweep for §0 Foundations

**Files:** none new

- [ ] **Step 1: Lint**

Run: `bunx @biomejs/biome@2.4.2 check .`
Expected: 0 errors. Fix any new findings introduced across Chunks 1a–1d.

- [ ] **Step 2: Test**

Run (with remote-DB credentials in `.env.local`): `bun --env-file=.env.local vitest run`
Expected: full suite green.

If you don't have remote-DB credentials configured locally, run the non-DB suite instead — DB-touching tests live under `lib/db/__tests__/` and `lib/ai/matching/__tests__/cascade*.test.ts` (per AGENTS.md DB-tests gotcha):

```bash
bun run test  # vitest, all non-DB tests
```

…then make sure the omitted DB tests pass in CI before merging.

- [ ] **Step 3: Sanity-check the migrations are well-ordered**

Run: `ls supabase/migrations/ | sort | tail -10`
Confirm the order is:
1. `<orig>_add_pipeline_requests_table.sql`
2. `<Chunk 1a ts>_add_pipeline_runs_table.sql`
3. `<Chunk 1a ts+1>_pipeline_runs_rls.sql`
4. `<Chunk 1a ts+2>_pipeline_requests_privacy.sql`
5. (optional, Chunk 1b) `<Chunk 1b ts>_match_functions_return_state.sql`

- [ ] **Step 4: No commit (verification only)**

If everything is green, §0 Foundations (Chunks 1a/1b/1c/1d) is complete. Proceed to Chunk 2.

---

### Chunk 1d — outcome verification (covers all of §0)

After Chunks 1a + 1b + 1c + 1d ship together, the system should:

- Write a `pipeline_runs` row per run with the version constants populated and Principle A guardrail enforced.
- Emit `mealItemId` and `ingredientId` in every SSE `item_name`/`item_macros` event.
- Carry `dbState` from the matching layer to the `MatchedIngredient` (consumed by Chunk 2).
- Have `pipeline_requests` retention reduced to 7 days with service-role-only RLS.
- Use id-keyed lookups in `assembly.ts` and `validation.ts` (no name-keyed collisions).
- Pass all sentinel-friendly tests (Chunk 2 sentinel tests build on the personalization-field telemetry from this chunk).

**No user-facing behavior change is expected.** The only observable difference for end users is that retry-pass nutrition now overwrites by id, which fixes a latent retry-replacement bug but is not visible until §4.4-style retries fire.

---

## Chunk 2: §3 Type-safe prompts (single phase)

**Spec sections:** §3.1 type-narrow `PromptPersonalizationContext` · §3.2 remove preference framing from nutrition prompt · §3.3 sentinel-value tests.

**Why next:** §0 closed the data-shape and telemetry foundations. §3 is the first behavior-touching change: it (1) compile-time-prevents preference fields from reaching prompt builders and (2) rewrites the nutrition prompt's "for cutting users…" framing to ask for honest uncertainty bounds. Per Decision 4, this ships as a single phase pre-production — no shadow runner gating.

**Outcome:** `buildDecompositionPrompt` and `buildNutritionPrompt` accept only `PromptPersonalizationContext` (a `Pick` of `UserContext` exposing `countryOfOrigin | countryOfResidence | cookingHabits` only). The nutrition prompt's `<why_three_values>` block no longer mentions cutting/bulking/aggression. Sentinel tests assert the prompts cannot leak `goal | aggression` even when called with a full `UserContext`. `dbState` (from Chunk 1b) and per-100g raw values are explicitly surfaced in the nutrition prompt so the LLM can reason about cooked vs raw correctly. **No factor-schema changes here** — that is Chunk 3.

---

### Task 2.1: Add `PromptPersonalizationContext` type

**Files:**
- Create: `lib/ai/prompts/types.ts`

> **Note on TDD vehicle:** the runtime sentinel tests in Tasks 2.2 and 2.3 are the red→green vehicle for the type narrowing — when the prompt builders are called with a full `UserContext` containing `goal: 'cutting'`, the sentinels assert no leakage. The compile-time guarantee is enforced by `bunx tsc --noEmit` (already part of the project's typecheck path) and by the narrowed signatures in Tasks 2.2/2.3. **Do not** create a `.test-d.ts` file: `vitest.config.ts` does not enable `typecheck`, the include glob `**/*.test.{ts,tsx}` does not match `.test-d.ts`, and `expectTypeOf`/`@ts-expect-error` are no-ops at runtime — such a file would silently pass regardless of the type definition.

- [ ] **Step 1: Create the type**

`lib/ai/prompts/types.ts`:

```ts
import type { UserContext } from '@/lib/ai/types';

/**
 * Spec §3.1 — the only `UserContext` slice that prompt builders are allowed
 * to read. Goal, aggression, and any future preference targets are
 * deliberately excluded so TypeScript prevents preference leakage at compile
 * time. See Principle A in the design spec:
 * docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */
export type PromptPersonalizationContext = Pick<
  UserContext,
  'countryOfOrigin' | 'countryOfResidence' | 'cookingHabits'
>;
```

- [ ] **Step 2: Verify with typecheck**

```bash
bunx tsc --noEmit
```

Expected: 0 errors. (No prompt builder consumes the type yet — the contract is exercised in Tasks 2.2/2.3.)

- [ ] **Step 3: Commit**

```bash
git add lib/ai/prompts/types.ts
git commit -m "feat(ai/prompts): add PromptPersonalizationContext type

Spec §3.1 — Pick<UserContext, 'countryOfOrigin' | 'countryOfResidence'
| 'cookingHabits'>. Prompt builders cannot reach goal/aggression at
compile time once Tasks 2.2/2.3 narrow their signatures. Sentinel
runtime tests in those tasks are the red→green vehicle.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2.2: Switch `buildDecompositionPrompt` to the narrow type

**Files:**
- Modify: `lib/ai/prompts/decomposition.ts`
- Modify: `lib/ai/pipeline/prompts.test.ts`

> **Regression-only task:** `decomposition.ts` already omits preference fields. The sentinel test freezes the contract before the type narrowing in Step 3. There is no red phase by design.

- [ ] **Step 1: Add the sentinel test**

Append to the existing `describe('buildDecompositionPrompt', …)` block in `lib/ai/pipeline/prompts.test.ts`:

```ts
it('does not leak goal/aggression/calorieTarget to the decomposition prompt (sentinel)', () => {
  const ctx = {
    ...sampleUserContext,
    goal: 'cutting' as const,
    aggression: 0.85,
  };
  const prompt = buildDecompositionPrompt(ctx);
  expect(prompt).not.toMatch(
    /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i,
  );
  expect(prompt).not.toMatch(/0\.85/);
});
```

- [ ] **Step 2: Run the test (should still pass today — but freezes the contract)**

```bash
bun run test lib/ai/pipeline/prompts.test.ts
```

Expected: PASS (current prompt does not reference goal/aggression). The test is a regression guard for Step 3.

- [ ] **Step 3: Narrow the function signature**

Change `buildDecompositionPrompt(userContext: UserContext)` → `buildDecompositionPrompt(userContext: PromptPersonalizationContext)`.

```ts
import type { PromptPersonalizationContext } from './types';

export function buildDecompositionPrompt(
  userContext: PromptPersonalizationContext,
): string {
  const { cookingHabits, countryOfOrigin, countryOfResidence } = userContext;
  // … existing body unchanged
}
```

- [ ] **Step 4: Run lint + tests + typecheck**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/prompts.test.ts lib/ai/prompts/__tests__/
```

Expected: 0 lint errors, all tests pass. The orchestrator and debug route call sites still work because `UserContext` is structurally assignable to `PromptPersonalizationContext`.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts/decomposition.ts lib/ai/pipeline/prompts.test.ts
git commit -m "refactor(ai/prompts): narrow buildDecompositionPrompt to PromptPersonalizationContext

Spec §3.1/§3.3 — compile-time prevent goal/aggression access in the
decomposition prompt; sentinel test as runtime regression guard.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2.3: Switch `buildNutritionPrompt` to the narrow type

**Files:**
- Modify: `lib/ai/prompts/nutrition.ts`
- Modify: `lib/ai/pipeline/prompts.test.ts`
- Modify: `lib/ai/prompts/__tests__/nutrition.test.ts` (this file uses `goal: 'cutting'` at line 11 in fixtures — sweep for assertions tied to the old framing)

- [ ] **Step 1: Write a failing sentinel test**

Append to the existing `describe('buildNutritionPrompt', …)` block in `lib/ai/pipeline/prompts.test.ts`. Use the existing `makeIngredient` fixture builder (around line 407 in the same file) and `makeMealItem` helper (around line 460) — do not introduce new fixtures:

```ts
it('does not leak goal/aggression/calorieTarget to the nutrition prompt (sentinel)', () => {
  const ctx = {
    ...sampleUserContext,
    goal: 'cutting' as const,
    aggression: 0.85,
  };
  const mealItems = [makeMealItem('Phở bò', ['gạo tẻ', 'thịt bò bắp'])];
  const matched = [
    makeIngredient('gạo tẻ'),
    makeIngredient('thịt bò bắp'),
  ];
  const prompt = buildNutritionPrompt(mealItems, matched, [], ctx);
  // Today this WILL FAIL — the prompt contains "cutting or bulking".
  expect(prompt).not.toMatch(
    /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i,
  );
  expect(prompt).not.toMatch(/0\.85/);
});
```

(Re-use the meal-item fixtures already declared above this block — search for `mealItems = [` near `describe('buildNutritionPrompt'`. Do not invent new fixtures.)

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun run test lib/ai/pipeline/prompts.test.ts
```

Expected: FAIL — current prompt contains `goal-based adjustments for users cutting or bulking` (`nutrition.ts:139`).

- [ ] **Step 3: Rewrite the `<why_three_values>` block to remove preference framing**

Edit `lib/ai/prompts/nutrition.ts` lines 138–144. Replace the existing block with:

```ts
  <why_three_values>
    Each macro is a triple LOW/MID/HIGH expressing genuine uncertainty about
    the user's actual portion and cooking behavior — not a preference signal.
    - MID: your best point estimate after cooking adjustment.
    - LOW:  conservative lower bound. Tighten when the ingredient is well-known
            and DB-matched. Widen when you are guessing (unknown oil quantity,
            ambiguous portion size, unmatched ingredient).
    - HIGH: conservative upper bound. Same widening rules.
    These bounds are physical-world uncertainty bounds. Downstream
    deterministic code applies any preference-shaped adjustment.
  </why_three_values>
```

Add the principle comment block at the top of the file (just after the imports, before the existing JSDoc):

```ts
/**
 * Principle A (spec §2): the LLM produces honest physical-world estimates
 * conditioned only on the meal text and the user's cooking identity (country
 * of origin/residence, cookingHabits). Goal, aggression, and calorie targets
 * NEVER reach this prompt — TypeScript enforces the boundary via
 * PromptPersonalizationContext.
 *
 * Spec: docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */
```

Add the same comment block at the top of `lib/ai/prompts/decomposition.ts` (per spec §3.2 "Same documentation comment block at top of `decomposition.ts`").

- [ ] **Step 4: Narrow the signature**

```ts
import type { PromptPersonalizationContext } from './types';

export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
): string {
  // existing body — verify only `cookingHabits`, `countryOfOrigin`,
  // `countryOfResidence` are read. They already are.
}
```

- [ ] **Step 5: Run tests**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/prompts.test.ts lib/ai/prompts/__tests__/
```

Expected: 0 lint errors, all tests pass — including the new sentinel test now that the cutting/bulking language is gone.

- [ ] **Step 6: Update existing tests that asserted the old language**

Run a sweep:

```bash
grep -nE "cutting|bulking|goal-based|genuine uncertainty" \
  lib/ai/pipeline/prompts.test.ts lib/ai/prompts/__tests__/
```

Required actions on the matches you find:

1. **Delete** the entire `it('explains why three values are needed for goal adjustment', …)` block in `lib/ai/pipeline/prompts.test.ts` (around lines 333–343, including the `expect(prompt).toContain('goal-based adjustments')` and `expect(prompt).toContain('genuine uncertainty')` assertions). The new sentinel test from Step 1 supersedes it — that block's premise is contradicted by spec §3.2.
2. For any remaining match in `lib/ai/prompts/__tests__/nutrition.test.ts` that asserts the old preference-shaped language, delete the assertion. Do not silently weaken — replace only with sentinel-style "does NOT match" guards if a regression check is still warranted at that level.
3. Fixture sites that simply set `goal: 'cutting'` on a `UserContext` literal (e.g., `nutrition.test.ts:11`) are fine to leave — `UserContext` is structurally assignable to `PromptPersonalizationContext`, so the call sites still type-check, and the sentinel ensures the field doesn't leak.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/prompts/nutrition.ts lib/ai/prompts/decomposition.ts \
  lib/ai/pipeline/prompts.test.ts
git commit -m "refactor(ai/prompts): remove preference framing; narrow nutrition prompt

Spec §3.1–§3.3 — buildNutritionPrompt accepts PromptPersonalizationContext;
<why_three_values> block reframed as physical uncertainty bounds with no
mention of cutting/bulking/aggression. Principle A documentation block
added to both prompt files. Sentinel test asserts no preference leakage.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2.4: Surface `dbState` as an attribute in the nutrition prompt (additive only)

The current prompt instructs the LLM that DB values are "per 100g RAW" and the runtime calls `convertCookedToRaw` **unconditionally** for every ingredient (`nutrition.ts:84-87` and `:111-113`) — including cooked-DB matches, which produces a nonsensical "raw equivalent" attribute. Resolving that contradiction requires retiring `convertCookedToRaw` and emitting state-aware scaling instructions, which is **Chunk 3's** scope.

This task is therefore **additive only**: emit `db_state` as a new attribute on every `<ingredient>` element so the LLM can see the matched-row's reference frame, but leave the existing `raw_grams` / `<per_100g_raw …/>` markup and the existing `<calculation>` instructions unchanged. Chunk 3 will (a) gate `convertCookedToRaw` on `dbState`, (b) rename the XML attributes, and (c) rewrite the `<calculation>` block with branching logic per `dbState`. Splitting it this way keeps Chunk 2 behavior-coherent: under today's runtime contract ("everything pre-converted to raw"), the prompt continues to read consistently.

**Files:**
- Modify: `lib/ai/prompts/nutrition.ts`
- Modify: `lib/ai/pipeline/prompts.test.ts`

- [ ] **Step 1: Write a failing test**

Append to `describe('buildNutritionPrompt', …)`:

```ts
it('emits db_state per matched ingredient when present', () => {
  const matched = [
    { ...makeIngredient('gạo tẻ'),       dbState: 'raw'    as const },
    { ...makeIngredient('thịt bò bắp'),  dbState: 'cooked' as const },
  ];
  const mealItems = [makeMealItem('Phở bò', ['gạo tẻ', 'thịt bò bắp'])];
  const prompt = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);
  expect(prompt).toMatch(/db_state="raw"/);
  expect(prompt).toMatch(/db_state="cooked"/);
});

it('defaults db_state to "unknown" when omitted from the match', () => {
  const matched = [makeIngredient('gạo tẻ')]; // no dbState
  const mealItems = [makeMealItem('Cơm trắng', ['gạo tẻ'])];
  const prompt = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);
  expect(prompt).toMatch(/db_state="unknown"/);
});
```

`makeIngredient` is the fixture builder around `prompts.test.ts:407`; `makeMealItem` is around `:460`. Spread `dbState` onto its return value as shown — `MatchedIngredient.dbState` was added in Chunk 1b.

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun run test lib/ai/pipeline/prompts.test.ts
```

Expected: FAIL — `db_state` attribute not yet emitted.

- [ ] **Step 3: Render `db_state` on each matched `<ingredient>` element**

In `nutrition.ts`, modify the matched-ingredient render line (currently `:88`):

```ts
const dbState = match.dbState ?? 'unknown';
ingredientData += `    <ingredient name="${ing.name}" source="db_matched" db_name="${match.matchedName}" db_state="${dbState}" raw_grams="${rawGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''}>\n`;
```

**Do not** modify the unmatched-ingredient render line (`:115`) — unmatched ingredients have no DB row and therefore no meaningful `dbState`. **Do not** modify the `<calculation>` instructions or the `<!-- DB values are per 100g RAW … -->` comment in this chunk — both stay as-is until Chunk 3 retires `convertCookedToRaw`.

- [ ] **Step 4: Run tests**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts/nutrition.ts lib/ai/pipeline/prompts.test.ts
git commit -m "feat(ai/prompts): emit db_state attribute on matched ingredients

Spec §3.2 (additive slice) — every <ingredient source=\"db_matched\">
element now carries db_state from the match layer (Chunk 1b),
defaulting to 'unknown' when absent. The <calculation> block and
runtime convertCookedToRaw call stay unchanged in this chunk; Chunk 3
retires convertCookedToRaw and rewrites the instructions to branch on
db_state.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2.5: Lint + test sweep for Chunk 2

**Files:** none new

- [ ] **Step 1: Lint**

```bash
bunx @biomejs/biome@2.4.2 check .
```

Expected: 0 errors.

- [ ] **Step 2: Test (DB-touching subset opt-in)**

```bash
bun run test
```

Expected: green.

If you have remote-DB credentials, also run:

```bash
bun --env-file=.env.local vitest run
```

- [ ] **Step 3: Verify the sentinel guarantees by hand**

The principle comment block at the top of each prompt file legitimately mentions "Goal, aggression, and calorie targets" — those are documentation, not rendered to the LLM. Anchor the grep to string-literal contents only, so the comment block does not pollute the output:

```bash
grep -nE '"[^"]*\b(cutting|bulking|maintaining|aggression)\b[^"]*"' \
  lib/ai/prompts/nutrition.ts lib/ai/prompts/decomposition.ts || \
  echo "OK — no preference-shaped strings in prompt bodies"
```

Expected: `OK — no preference-shaped strings in prompt bodies`. (The runtime sentinel tests from Tasks 2.2/2.3 are the authoritative guarantee; this grep is a quick eyeball check.)

- [ ] **Step 4: No commit (verification only)**

If everything is green, Chunk 2 is complete. Proceed to Chunk 3.

---

### Chunk 2 — outcome verification

After Chunk 2 ships:

- [ ] `PromptPersonalizationContext` is exported from `lib/ai/prompts/types.ts`.
- [ ] Both prompt builders accept `PromptPersonalizationContext` (not `UserContext`).
- [ ] Sentinel tests in `lib/ai/pipeline/prompts.test.ts` assert no `goal | aggression | cutting | bulking | maintaining` strings or aggression numbers leak into either prompt.
- [ ] The `<why_three_values>` block in the nutrition prompt no longer references cutting/bulking; it frames bounds as physical uncertainty.
- [ ] Each matched `<ingredient>` element in the nutrition prompt carries `db_state="raw" | "cooked" | "unknown"` (additive only — the `<calculation>` instructions and `convertCookedToRaw` runtime call are unchanged in this chunk; Chunk 3 owns that rewrite).
- [ ] Principle A documentation comment block is at the top of both `nutrition.ts` and `decomposition.ts`.
- [ ] All call sites (`orchestrator.ts`, `app/api/analyze-meal/debug/route.ts`) compile because `UserContext` remains structurally assignable to `PromptPersonalizationContext`.

**User-facing behavior change:** the nutrition prompt now produces honest uncertainty bounds rather than goal-shaped framing. The shape of the LLM's output (BoundedNutrition triples) is unchanged. Downstream `goal-adjustment.ts` will receive bounds that better reflect physical uncertainty, so its preference-shaped output may shift slightly — this is intended.

---

## Chunk 3: §1 Absolute-macro schema + retire `convertCookedToRaw`

**Spec sections:** §1.1 single `IngredientNutrition` shape · §1.2 runtime aggregation · §1.3 macro-consistency invariant · §1.4 density envelope · §1.5 retire `COOKED_TO_RAW_FACTOR` / `convertCookedToRaw`.

**Why next:** Chunk 2 surfaced `dbState` to the prompt without changing scaling behavior — the runtime still pre-converts grams unconditionally. Chunk 3 closes that loop: the LLM now produces final adjusted absolute macros for the as-eaten portion and the runtime stops calling `convertCookedToRaw` on the live path. New validators (`density_envelope`, `macro_inconsistent`) replace the old `factor_envelope` concept and feed the `pipeline_runs` counters added in Chunk 1d.

**Outcome:** `nutrition.ts`'s `<calculation>` block branches on `db_state` and tells the LLM to scale against `as_eaten_grams` instead of `raw_grams` (no runtime pre-conversion). `mergeNutrition` accepts `estimatedGrams` directly. `convertCookedToRaw` remains exported as an instrumented fallback only — every call increments `cooked_to_raw_factor_fires` (Chunk 1d telemetry), with a single legitimate caller during the transition (`validation.ts` DB-deviation check). Two new anomaly types + retry path land. Spec §1.5 retirement gate (`< 5% fire rate over 7 days`) is checked manually post-launch and is **not** part of this chunk.

---

### Task 3.1: Anomaly enum + threshold constants

**Files:**
- Modify: `lib/ai/pipeline/validation.ts`
- Modify: `lib/ai/pipeline/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/ai/pipeline/validation.test.ts`. The existing helpers in that file are `makeMatched({ ingredientName, … })`, `makeDecomposition([{ name, ingredients: [{ name, grams, cooking? }] }])`, and `makeNutrition([{ name, ingredients: [{ name, midKcal, lowKcal?, highKcal? }] }])`. `makeNutrition` hard-codes `proteinG/carbohydrateG/fatG` channels — Step 1a extends it (additively) to accept per-channel overrides; Step 1b uses the extended helper.

**Step 1a — extend `makeNutrition` to accept channel overrides** (commit this with the failing tests, since the new tests need the extension):

```ts
function makeNutrition(
  items: {
    name: string;
    ingredients: {
      name: string;
      midKcal: number;
      lowKcal?: number;
      highKcal?: number;
      proteinG?: { low: number; mid: number; high: number };
      carbohydrateG?: { low: number; mid: number; high: number };
      fatG?: { low: number; mid: number; high: number };
    }[];
  }[]
): NutritionAdjustment {
  // existing body, but spread the optional overrides over the defaults:
  // proteinG: ing.proteinG ?? { low: 5, mid: 10, high: 15 }, etc.
}
```

**Step 1b — append the new describe blocks**:

```ts
describe('density envelope (§1.4)', () => {
  it('flags caloriesKcal density above 900 kcal/100g', () => {
    const anomalies = validateNutritionOutput(
      makeNutrition([{ name: 'M', ingredients: [{ name: 'cá hồi', midKcal: 950, lowKcal: 800, highKcal: 1100 }] }]),
      [makeMatched({ ingredientName: 'cá hồi' })],
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'density_envelope')).toBeDefined();
  });

  it('flags negative low bound', () => {
    const anomalies = validateNutritionOutput(
      makeNutrition([{
        name: 'M',
        ingredients: [{ name: 'cá hồi', midKcal: 100, proteinG: { low: -1, mid: 5, high: 10 } }],
      }]),
      [makeMatched({ ingredientName: 'cá hồi' })],
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'density_envelope')).toBeDefined();
  });

  it('fires for unmatched ingredients too', () => {
    // No matchedLookup hit — density check must still run.
    const anomalies = validateNutritionOutput(
      makeNutrition([{ name: 'M', ingredients: [{ name: 'mystery sauce', midKcal: 950, lowKcal: 800, highKcal: 1100 }] }]),
      [], // no matches
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'mystery sauce', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'density_envelope')).toBeDefined();
  });

  it('does not flag legal densities', () => {
    const anomalies = validateNutritionOutput(
      makeNutrition([{ name: 'M', ingredients: [{ name: 'cá hồi', midKcal: 130, lowKcal: 100, highKcal: 160 }] }]),
      [makeMatched({ ingredientName: 'cá hồi' })],
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'density_envelope')).toBeUndefined();
  });
});

describe('macro consistency invariant (§1.3)', () => {
  it('flags >20% deviation between caloriesKcal.mid and 4P+4C+9F', () => {
    // macros: 4·5 + 4·30 + 9·10 = 230; reported 400; deviation = 170/400 = 42.5% > 20%.
    const anomalies = validateNutritionOutput(
      makeNutrition([{
        name: 'M',
        ingredients: [{
          name: 'cá hồi', midKcal: 400, lowKcal: 350, highKcal: 450,
          proteinG: { low: 4, mid: 5, high: 6 },
          carbohydrateG: { low: 28, mid: 30, high: 32 },
          fatG: { low: 9, mid: 10, high: 11 },
        }],
      }]),
      [makeMatched({ ingredientName: 'cá hồi' })],
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'macro_inconsistent')).toBeDefined();
  });

  it('accepts within 20% (fiber/alcohol/rounding)', () => {
    // macros: 230; reported 260; deviation = 30/260 ≈ 11.5% (denom is reportedKcal per §1.3).
    const anomalies = validateNutritionOutput(
      makeNutrition([{
        name: 'M',
        ingredients: [{
          name: 'cá hồi', midKcal: 260, lowKcal: 230, highKcal: 290,
          proteinG: { low: 4, mid: 5, high: 6 },
          carbohydrateG: { low: 28, mid: 30, high: 32 },
          fatG: { low: 9, mid: 10, high: 11 },
        }],
      }]),
      [makeMatched({ ingredientName: 'cá hồi' })],
      makeDecomposition([{ name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] }]),
    );
    expect(anomalies.find((a) => a.type === 'macro_inconsistent')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
bun run test lib/ai/pipeline/validation.test.ts
```

Expected: FAIL on the new tests — `density_envelope` and `macro_inconsistent` not yet anomaly types.

- [ ] **Step 3: Add the new types + thresholds**

In `lib/ai/pipeline/validation.ts`. Note: the file already exports `MAX_KCAL_PER_100G = 900` for the existing `calorie_density` check on DB rows. Reuse that constant for the kcal cap and add the three macro caps + the consistency tolerance:

```ts
export const THRESHOLDS = {
  // existing thresholds…
  /** Spec §1.4 — per-100g macro caps; high bound triggers the envelope. */
  DENSITY_PROTEIN_PER_100G_MAX: 100,
  DENSITY_CARB_PER_100G_MAX: 100,
  DENSITY_FAT_PER_100G_MAX: 100,
  /** Spec §1.3 — kcal identity tolerance; denominator is reportedKcal. */
  MACRO_KCAL_IDENTITY_TOLERANCE: 0.20,
} as const;

export type AnomalyType =
  | 'calorie_density'
  | 'meal_item_cap'
  | 'weight_implausible'
  | 'db_deviation'
  | 'total_calories'
  | 'unmatched_ratio'
  | 'density_envelope'   // NEW (§1.4)
  | 'macro_inconsistent'; // NEW (§1.3)
```

- [ ] **Step 4: Add the validators**

The §1.3 and §1.4 checks must run for **every** ingredient (matched or unmatched) — density and kcal-identity are physical-world invariants on LLM output, not DB-anchored sanity checks. Lift the `decomposed` lookup out of the existing `if (matchInfo)` branch first, then run the two checks unconditionally in the per-ingredient loop:

```ts
for (const ing of mealItem.ingredients) {
  const midKcal = ing.caloriesKcal.mid;
  mealItemMidKcal += midKcal;

  // Lift decomposition lookup OUT of `if (matchInfo)` so unmatched ingredients
  // also get §1.3/§1.4 checks.
  const decomposed = decomposedLookup.get(ing.ingredientName);

  const matchInfo = matchedLookup.get(ing.ingredientName);
  if (matchInfo) {
    // existing calorie_density + db_deviation checks (use `decomposed` here)
  }

  // §1.4 — density envelope (matched + unmatched)
  const grams = decomposed?.estimatedGrams ?? null;
  if (grams && grams > 0) {
    const density = (val: number) => (val / grams) * 100;
    const breaches: string[] = [];
    if (ing.caloriesKcal.high > 0 &&
        density(ing.caloriesKcal.high) > THRESHOLDS.MAX_KCAL_PER_100G) {
      breaches.push(`kcal density ${density(ing.caloriesKcal.high).toFixed(0)}/100g > ${THRESHOLDS.MAX_KCAL_PER_100G}`);
    }
    if (ing.proteinG.high      > 0 && density(ing.proteinG.high)      > THRESHOLDS.DENSITY_PROTEIN_PER_100G_MAX) breaches.push(`protein density ${density(ing.proteinG.high).toFixed(0)}/100g`);
    if (ing.carbohydrateG.high > 0 && density(ing.carbohydrateG.high) > THRESHOLDS.DENSITY_CARB_PER_100G_MAX)    breaches.push(`carb density ${density(ing.carbohydrateG.high).toFixed(0)}/100g`);
    if (ing.fatG.high          > 0 && density(ing.fatG.high)          > THRESHOLDS.DENSITY_FAT_PER_100G_MAX)     breaches.push(`fat density ${density(ing.fatG.high).toFixed(0)}/100g`);
    if (ing.caloriesKcal.low < 0 || ing.proteinG.low < 0 || ing.carbohydrateG.low < 0 || ing.fatG.low < 0) {
      breaches.push('negative low bound');
    }
    if (breaches.length > 0) {
      anomalies.push({
        type: 'density_envelope',
        message: `${ing.ingredientName}: ${breaches.join('; ')}`,
        severity: 'warning',
      });
    }
  }

  // §1.3 — macro consistency (matched + unmatched). Denominator is reportedKcal
  // (max 1) so over-reporting kcal vs macros is symmetric to under-reporting.
  for (const channel of ['low', 'mid', 'high'] as const) {
    const kcalFromMacros =
      4 * ing.proteinG[channel] +
      4 * ing.carbohydrateG[channel] +
      9 * ing.fatG[channel];
    const reportedKcal = ing.caloriesKcal[channel];
    const denom = Math.max(reportedKcal, 1);
    const deviation = Math.abs(reportedKcal - kcalFromMacros) / denom;
    if (deviation > THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE) {
      anomalies.push({
        type: 'macro_inconsistent',
        message: `${ing.ingredientName} ${channel}: kcal ${reportedKcal.toFixed(0)} vs 4P+4C+9F=${kcalFromMacros.toFixed(0)} (${(deviation * 100).toFixed(0)}% > ${(THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE * 100).toFixed(0)}%)`,
        severity: 'warning',
      });
      break; // one anomaly per ingredient
    }
  }
}
```

- [ ] **Step 5: Run lint + tests**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/validation.test.ts
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/validation.ts lib/ai/pipeline/validation.test.ts
git commit -m "feat(ai/validation): add density_envelope and macro_inconsistent anomaly types

Spec §1.3 + §1.4 — per-ingredient density bounds (≤900 kcal, ≤100g
each macro per 100g) and 4P+4C+9F kcal identity within 20% tolerance.
Both fire as warnings; retry policy hooks them in Task 3.5.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.2: Aggregate counters in the orchestrator + extend `pipeline_runs` row

Chunk 1d landed `buildPipelineRunRow({ counters: { densityEnvelopeFires, macroInconsistentFires, cookedToRawFactorFires, … } })` in `lib/ai/pipeline/run-telemetry.ts`. The builder is **input-driven** — it does not aggregate anomalies itself. The aggregation happens at the orchestrator's `counters: {…}` assembly site, immediately before the `buildPipelineRunRow(…)` call. Tasks 3.2 and 3.3 share that site (3.2 fills `densityEnvelopeFires` + `macroInconsistentFires`; 3.3 fills `cookedToRawFactorFires`).

**Files:**
- Modify: `lib/ai/pipeline/orchestrator.ts` — the block that constructs `counters` for `buildPipelineRunRow`.
- Modify: `lib/ai/pipeline/__tests__/run-telemetry.test.ts` — already exists from Chunk 1d; extend with the orchestrator-level integration cases below.

- [ ] **Step 1: Failing test**

Append to `__tests__/run-telemetry.test.ts` an integration-level `describe('orchestrator → buildPipelineRunRow', …)` (use the same orchestrator harness Chunk 1d set up there). Two cases:

```ts
it('aggregates density_envelope warnings into counters.densityEnvelopeFires', async () => {
  // Inject a Call 2 result that breaches kcal density on one ingredient.
  const { row } = await runOrchestratorWithFixture({
    nutritionOutput: nutritionWithKcalDensityBreach,
  });
  expect(row.densityEnvelopeFires).toBe(1);
  expect(row.macroInconsistentFires).toBe(0);
  expect(row.anomalyTypes).toContain('density_envelope');
});

it('aggregates macro_inconsistent warnings into counters.macroInconsistentFires', async () => {
  const { row } = await runOrchestratorWithFixture({
    nutritionOutput: nutritionWithKcalIdentityBreach,
  });
  expect(row.macroInconsistentFires).toBe(1);
  expect(row.densityEnvelopeFires).toBe(0);
  expect(row.anomalyTypes).toContain('macro_inconsistent');
});
```

If `runOrchestratorWithFixture` is not yet a helper in this file (Chunk 1d may have used inline orchestrator calls), inline an equivalent invocation — match Chunk 1d's existing pattern.

- [ ] **Step 2: Confirm fail**

```bash
bun run test lib/ai/pipeline/__tests__/run-telemetry.test.ts
```

Expected: FAIL — orchestrator's `counters` block does not yet aggregate the new anomaly types.

- [ ] **Step 3: Aggregate counts at the orchestrator's `counters` site**

Locate the orchestrator block that builds the `counters` argument to `buildPipelineRunRow` (Chunk 1d wired this; grep `buildPipelineRunRow(` in `orchestrator.ts`). Add to the counters object literal (camelCase, matching `BuildPipelineRunRowInput.counters`):

```ts
counters: {
  // existing entries from Chunk 1d…
  densityEnvelopeFires:   allAnomalies.filter((a) => a.type === 'density_envelope').length,
  macroInconsistentFires: allAnomalies.filter((a) => a.type === 'macro_inconsistent').length,
  // cookedToRawFactorFires is filled by Task 3.3 — leave the existing 0 for now
},
```

`anomaly_types: text[]` is already populated by `buildPipelineRunRow` from the deduplicated anomaly type list — no changes needed there.

- [ ] **Step 4: Test green; commit**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/__tests__/run-telemetry.test.ts
git add -u
git commit -m "feat(ai/pipeline): aggregate density_envelope and macro_inconsistent counters

Spec §0.4 — per-run camelCase counters densityEnvelopeFires and
macroInconsistentFires fed into buildPipelineRunRow at the orchestrator
counters site (added in Chunk 1d). cookedToRawFactorFires lands in Task 3.3.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.3: Stop pre-converting grams in `assembly.ts` (live path)

The runtime currently pre-scales DB nutrition against `rawEquivalentGrams = convertCookedToRaw(estimatedGrams, cookingMethod)` (`assembly.ts:128`). Per spec §1.5 the LLM now produces final adjusted macros for the as-eaten portion, so DB scaling at this layer is only used for the **non-LLM macros** (the 24 nutrients in `mergeNutrition`'s else-branch). Those values were always under the same prior assumption, but with `dbState` flowing through Chunk 1b/2 the correct rule is:

- `dbState === 'cooked'`: scale DB per-100g against `estimatedGrams` directly (no conversion).
- `dbState === 'raw' | 'unknown'`: keep the legacy `convertCookedToRaw` behavior (instrumented fallback per §1.5) until raw-only DBs catch up.

This is the live-path change. The legacy fallback is intentional — pulling the conversion entirely would silently undercount fiber/iron/etc. on cooked-DB raw food until the broader retirement gate is met.

**Files:**
- Modify: `lib/ai/pipeline/assembly.ts`
- Modify: `lib/ai/pipeline/assembly.test.ts` (or the file that exercises `mergeNutrition` — verify location with `grep -l mergeNutrition lib/ai`)
- Modify: `lib/ai/types.ts` (`ProcessedIngredient.rawEquivalentGrams` is no longer always raw — keep the field for back-compat but document)

- [ ] **Step 1: Write failing tests**

Add to the assembly test file. The behaviour we're driving is observational: with `dbState === 'cooked'` and a non-trivial `cookingMethod`, the pre-conversion factor (e.g. `kho` → 0.8) must NOT be applied to the DB-scaled non-LLM nutrients. We assert that downstream by reading the resulting `boundedNutrition` for an LLM-omitted nutrient (e.g. `fiberG`) — those flow straight from `mergeNutrition`'s else-branch with `(per100g * dbScalingGrams) / 100`. Spy-on-named-import is unreliable here (the local binding inside `assembly.ts` does not re-resolve), so we use observational assertions on numeric output instead.

```ts
describe('assembleResult — dbState-aware DB scaling', () => {
  it('uses estimatedGrams (not raw-converted) for DB scaling when dbState is "cooked"', () => {
    const matched: MatchedIngredient[] = [
      // dbState === 'cooked' → no convertCookedToRaw call.
      {
        ...makeMatch('thịt bò bắp'),
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([{ name: 'Phở bò', ingredients: [{
      ingredientId: 'ing-1', name: 'thịt bò bắp', estimatedGrams: 80, cookingMethod: 'kho',
    }]}]);
    const llm = makeLlmNutrition('thịt bò bắp', 'Phở bò', { caloriesKcal: { low: 100, mid: 150, high: 200 } });

    const result = assembleResult(decomp, llm, matched, [], userCtx);
    const ing = result.mealItems[0].ingredients[0];

    // dbScalingGrams === estimatedGrams === 80 → fiberG = (10 * 80) / 100 = 8.0
    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(8.0, 5);
    // Field surfaces the gram value used: equals estimatedGrams.
    expect(ing.rawEquivalentGrams).toBe(80);
  });

  it('applies convertCookedToRaw when dbState === "raw"', () => {
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('gạo tẻ'),
        ingredientId: 'ing-2',
        dbState: 'raw',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([{ name: 'Cơm', ingredients: [{
      ingredientId: 'ing-2', name: 'gạo tẻ', estimatedGrams: 200, cookingMethod: 'nấu',
    }]}]);
    const llm = makeLlmNutrition('gạo tẻ', 'Cơm', { caloriesKcal: { low: 100, mid: 150, high: 200 } });

    const result = assembleResult(decomp, llm, matched, [], userCtx);
    const ing = result.mealItems[0].ingredients[0];

    // 'nấu' factor is 0.38 → dbScalingGrams = round(200 * 0.38) = 76.
    // fiberG = (10 * 76) / 100 = 7.6
    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(7.6, 1);
    expect(ing.rawEquivalentGrams).toBe(76);
  });

  it('treats dbState === "unknown" as legacy fallback (instrumented per §1.5)', () => {
    // Per Chunk 1b Task 1.7, dbState is non-optional with 'unknown' as the default.
    // Behaviour matches the legacy convertCookedToRaw path.
    const matched: MatchedIngredient[] = [
      {
        ...makeMatch('cá'),
        ingredientId: 'ing-3',
        dbState: 'unknown',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, fiberG: 10 },
      },
    ];
    const decomp = makeDecomposition([{ name: 'Cá kho', ingredients: [{
      ingredientId: 'ing-3', name: 'cá', estimatedGrams: 100, cookingMethod: 'kho',
    }]}]);
    const llm = makeLlmNutrition('cá', 'Cá kho', { caloriesKcal: { low: 100, mid: 120, high: 140 } });

    const result = assembleResult(decomp, llm, matched, [], userCtx);
    const ing = result.mealItems[0].ingredients[0];

    // 'kho' factor is 0.8 → dbScalingGrams = 80; fiberG = 8.0
    expect(ing.rawEquivalentGrams).toBe(80);
    expect(ing.boundedNutrition.fiberG?.mid).toBeCloseTo(8.0, 5);
  });
});
```

For the §1.5 retirement counter, add a parallel test in `__tests__/run-telemetry.test.ts` (the orchestrator-integration `describe` block from Task 3.2):

```ts
it('increments cookedToRawFactorFires once per non-cooked-DB match', async () => {
  // 2 matched ingredients: one cooked, one raw, one unknown.
  const { row } = await runOrchestratorWithFixture({
    matched: [
      { ingredientName: 'thịt bò bắp', dbState: 'cooked' },
      { ingredientName: 'gạo tẻ',      dbState: 'raw' },
      { ingredientName: 'cá',          dbState: 'unknown' },
    ],
  });
  // raw + unknown trigger the legacy convertCookedToRaw path.
  expect(row.cookedToRawFactorFires).toBe(2);
});

it('cookedToRawFactorFires is 0 when every match is cooked-DB', async () => {
  const { row } = await runOrchestratorWithFixture({
    matched: [
      { ingredientName: 'thịt bò bắp', dbState: 'cooked' },
      { ingredientName: 'rau muống',   dbState: 'cooked' },
    ],
  });
  expect(row.cookedToRawFactorFires).toBe(0);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun run test lib/ai/pipeline/assembly.test.ts
```

Expected: FAIL — `convertCookedToRaw` is currently called unconditionally regardless of `dbState`.

- [ ] **Step 3: Make the conversion conditional**

Replace `assembly.ts:128–131` with:

```ts
const dbState = matchInfo?.dbState ?? 'unknown';
const dbScalingGrams =
  dbState === 'cooked'
    ? ing.estimatedGrams
    : convertCookedToRaw(ing.estimatedGrams, ing.cookingMethod);
```

Then pass `dbScalingGrams` into `mergeNutrition` (replacing `rawEquivalentGrams`) and store it on `ProcessedIngredient` keyed under the existing `rawEquivalentGrams` field name. The field name is retained for back-compat with `mappers.ts` consumers; Step 4 documents the new meaning.

- [ ] **Step 4: Update the field-level comment in `lib/ai/types.ts`**

```ts
/**
 * Grams used internally for DB-row nutrition scaling. Equals `estimatedGrams`
 * when the matched DB row is cooked. Equals
 * `convertCookedToRaw(estimatedGrams, cookingMethod)` when the row is raw or
 * dbState is 'unknown'. Display layers should use `estimatedGrams`.
 *
 * @deprecated Field name is misleading post-Chunk 3. Rename to `dbScalingGrams`
 * in a follow-up once spec §1.5 retirement gate trips and the legacy fallback
 * is removed entirely.
 */
rawEquivalentGrams: number;
```

- [ ] **Step 5: Surface `cookedToRawFactorFires` to the orchestrator's counters site**

The cleanest route given Chunk 1d's `BuildPipelineRunRowInput.counters` shape: extend `assembleResult`'s return with a small instrumentation channel rather than adding a side-effect counter.

Add to `lib/ai/pipeline/assembly.ts`:

```ts
export interface AssemblyMetrics {
  cookedToRawFactorFires: number;
}

// Replace the existing `return { mealItems: pipelineMealItems, … };` with:
return {
  result: { mealItems: pipelineMealItems, /* … existing fields */ },
  metrics: { cookedToRawFactorFires } satisfies AssemblyMetrics,
};
```

Where `cookedToRawFactorFires` is incremented inside the per-ingredient loop whenever `dbState !== 'cooked'`. Update the orchestrator to destructure `{ result, metrics } = assembleResult(…)` and forward `metrics.cookedToRawFactorFires` into the `counters` object passed to `buildPipelineRunRow` (the same site Task 3.2 touches).

If this return-shape change exceeds the chunk LOC budget, the fallback is a module-scoped `let cookedToRawFactorFires = 0;` reset at the top of `assembleResult` and exported via a sibling getter — but prefer the structured return. Either way, the orchestrator's `counters.cookedToRawFactorFires:` line must be filled with a real source — leaving it `0` after this task is a regression.

Update every existing `assembleResult(…)` caller (orchestrator + tests) to consume the new return shape.

- [ ] **Step 6: Lint + tests + commit**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/
git add -u
git commit -m "feat(ai/assembly): scale DB nutrition by dbState; instrument legacy fallback

Spec §1.5 — when match.dbState === 'cooked' the LLM's macros and the
DB-scaled non-macros are both anchored to as-eaten grams; no
convertCookedToRaw call. When dbState is 'raw' or absent, the legacy
conversion stays as instrumented fallback. cooked_to_raw_factor_fires
increments on each fallback so the spec-§1.5 retirement gate
(< 5% over 7 days) is observable.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.4: Replace `<calculation>` instructions in the nutrition prompt

Chunk 2 deferred this. Now that the runtime stops pre-converting on the cooked-DB path (Task 3.3), the prompt must tell the LLM the truth about what `as_eaten_grams` (renamed from `raw_grams`) means per `dbState`.

**Files:**
- Modify: `lib/ai/prompts/nutrition.ts`
- Modify: `lib/ai/pipeline/prompts.test.ts`

- [ ] **Step 1: Failing test**

Append:

```ts
it('emits as_eaten_grams (not raw_grams) and dbState-aware <calculation>', () => {
  const matched = [
    { ...makeIngredient('thịt bò bắp'), dbState: 'cooked' as const, ingredientId: 'i1' },
    { ...makeIngredient('gạo tẻ'),       dbState: 'raw'    as const, ingredientId: 'i2' },
  ];
  const mealItems = [makeMealItem('Phở bò', ['thịt bò bắp', 'gạo tẻ'])];
  const prompt = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);

  expect(prompt).toMatch(/as_eaten_grams="\d+"/);
  expect(prompt).not.toMatch(/raw_grams=/);
  expect(prompt).toMatch(/db_state="cooked"/);
  expect(prompt).toMatch(/db_state="raw"/);
  // Calculation block instructs branching by db_state
  expect(prompt).toMatch(/db_state.*"cooked".*as_eaten_grams/s);
  expect(prompt).toMatch(/db_state.*"raw".*adjust for cooking method/s);
});
```

- [ ] **Step 2: Confirm fail**

```bash
bun run test lib/ai/pipeline/prompts.test.ts
```

Expected: FAIL — XML still emits `raw_grams=`.

- [ ] **Step 3: Rename XML attributes and rewrite the comment**

In `nutrition.ts`. The `const dbState = match.dbState ?? 'unknown';` line is already in place from Chunk 2 Task 2.4 — reuse it. Update only the XML emit and the `<calculation>` block.

```ts
ingredientData +=
  '  <!-- as_eaten_grams is the user-facing portion. db_state tells you whether the per_100g values are raw or cooked. -->\n\n';

// matched render line (dbState already declared above per Chunk 2):
ingredientData += `    <ingredient name="${ing.name}" source="db_matched" db_name="${match.matchedName}" db_state="${dbState}" as_eaten_grams="${ing.estimatedGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''}>\n`;
ingredientData += `      <per_100g caloriesKcal="${match.nutritionPer100g.caloriesKcal ?? '?'}" proteinG="${match.nutritionPer100g.proteinG ?? '?'}" carbohydrateG="${match.nutritionPer100g.carbohydrateG ?? '?'}" fatG="${match.nutritionPer100g.fatG ?? '?'}" />\n`;

// unmatched render line:
unmatchedSection += `    <ingredient name="${ing.name}" as_eaten_grams="${ing.estimatedGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''} />\n`;
```

Drop the `convertCookedToRaw` import from `nutrition.ts` — it's no longer called from this file. The unmatched branch had been calling it too (`nutrition.ts:111-113`); that path also disappears.

- [ ] **Step 4: Replace the `<calculation>` block**

Find the existing `<calculation>` block in the prompt template (it currently asserts "DB values are per 100g RAW"). Replace with:

```
  <calculation>
    Each ingredient has db_state: "raw" | "cooked" | "unknown".

    1. db_state="cooked": per_100g values are already cooked.
       Scale base = (as_eaten_grams / 100) × per_100g, then adjust as needed
       for the *user's actual cooking style* (e.g., extra oil from "nhiều dầu"
       cooking habit). No raw/cooked conversion needed — both sides are cooked.

    2. db_state="raw": per_100g values are raw, as_eaten_grams is cooked.
       Adjust for cooking method using your knowledge:
         - frying (chiên/rán/xào) absorbs cooking oil → fat goes UP
         - boiling (luộc/nấu) drives moisture changes; rice absorbs water → mass UP
         - grilling (nướng) drives moisture out → density UP
       Produce final macros for the as-eaten portion.

    3. db_state="unknown": treat as "raw" but widen LOW/HIGH bounds — uncertainty
       is higher because the reference frame is ambiguous.

    For unmatched ingredients (no db row): use your knowledge of Vietnamese
    cuisine for typical macros at the as-eaten weight. Be wider on bounds.

    MID = your best estimate after cooking adjustment. LOW/HIGH bracket
    physical-world uncertainty (portion guess + cooking variance).
  </calculation>
```

- [ ] **Step 5: Run tests**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/ lib/ai/prompts/
```

Expected: green. The Chunk 2 sentinel test still passes because the new instructions don't reference goal/aggression. The Chunk 2 `db_state="..."` test still passes because the attribute survives.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/prompts/nutrition.ts lib/ai/pipeline/prompts.test.ts
git commit -m "refactor(ai/prompts): rename raw_grams → as_eaten_grams; branch <calculation> by db_state

Spec §1.5 — runtime no longer pre-converts grams on cooked-DB matches
(Task 3.3). Prompt now tells the LLM the truth: as_eaten_grams is the
user's portion, db_state says which reference frame the per_100g
values are in. Drops convertCookedToRaw from this file.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.5: Hook new anomalies into the retry policy (§4.2 trigger preview)

Spec §1.4 says: "Any breach → density_envelope_fires++, anomaly type density_envelope, retry/escalation per §4." The full retry/escalation logic (`pickComputePolicy`) is Chunk 5. For now, ensure the existing retry loop in `orchestrator.ts` recognises the two new anomaly types as "should retry" — same triage as today's `db_deviation` warnings, no escalation yet.

**Files:**
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Modify: `lib/ai/pipeline/orchestrator.test.ts` (or wherever the retry-loop test lives)

- [ ] **Step 1: Failing test**

Add a test that injects a Call 2 result with one `density_envelope` anomaly and asserts a retry happens (consistent with the existing `db_deviation` retry test).

- [ ] **Step 2: Confirm failure**

```bash
bun run test lib/ai/pipeline/orchestrator.test.ts
```

- [ ] **Step 3: Extend the retry condition**

Locate the orchestrator's retry-decider (it tests `anomalies.some((a) => a.severity === 'warning' && /* … */)` or similar). Add `density_envelope` and `macro_inconsistent` to the retry-eligible set. **Do not** add escalation logic — that's Chunk 5.

- [ ] **Step 4: Tests + commit**

```bash
bunx @biomejs/biome@2.4.2 check .
bun run test lib/ai/pipeline/
git add -u
git commit -m "feat(ai/pipeline): retry on density_envelope and macro_inconsistent anomalies

Spec §1.3/§1.4 — these warnings now trigger the same single-retry path
as db_deviation. Escalation to ESCALATION_MODEL is intentionally
deferred to Chunk 5 (§4.2 pickComputePolicy).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.6: Tighten the live `mergeNutrition` signature (optional, scope-permitting)

The §1.1 spec frames `IngredientNutrition` as the unified shape. Today's runtime consumes `IngredientLlmNutrition + DB → BoundedNutrition` via `mergeNutrition`. The shape difference is the 24 non-LLM nutrients that flow through from DB. Per the spec ("single shape — no discriminated union"), these should converge.

**This task is gated.** Only do it if the diff fits the chunk LOC budget. Otherwise defer to a follow-up — the live behaviour is correct without it, and Chunk 4 (eval flywheel) doesn't depend on this convergence.

If you proceed:

- Introduce `IngredientNutrition` in `lib/ai/types.ts` matching the spec §1.1 shape (`ingredientId`, optional `matchedDbId`, four bounded macros, optional `uncertaintyReason`).
- Have `assembleResult` return `IngredientNutrition[]` alongside the existing `BoundedNutrition` shape (which keeps the 24 DB nutrients).
- `IngredientNutrition` is the contract for shadow-runner pair records (Chunk 4) and KPI rollups; `BoundedNutrition` stays the runtime detail.
- Add a unit test covering the conversion.

If it spills past 200 LOC, **stop and ship Task 3.6 as a follow-up chunk**. Note in the chunk-summary review that 3.6 was deferred so the reviewer doesn't flag it as missing.

---

### Task 3.7: Final sweep + outcome verification

- [ ] **Step 1: Lint**

```bash
bunx @biomejs/biome@2.4.2 check .
```

- [ ] **Step 2: Test**

```bash
bun run test
```

- [ ] **Step 3: Hand-check `convertCookedToRaw` callers**

```bash
grep -rn "convertCookedToRaw" lib/ai/ | grep -v "lib/ai/constants.ts"
```

Expected: matches only in `lib/ai/pipeline/assembly.ts` (the gated fallback) and `lib/ai/pipeline/validation.ts` (DB-deviation comparator — Task 3.3 leaves this alone; the validator computes the legacy DB-scaled value as a sanity baseline). No call from `lib/ai/prompts/nutrition.ts`.

- [ ] **Step 4: Hand-check the prompt body**

```bash
grep -n "raw_grams\|per_100g_raw" lib/ai/prompts/nutrition.ts
```

Expected: zero hits (renamed to `as_eaten_grams` and `per_100g`).

---

### Chunk 3 — outcome verification

After Chunk 3 ships:

- [ ] `validation.ts` exports `density_envelope` and `macro_inconsistent` as `AnomalyType`s with the §1.3/§1.4 thresholds. Both run for matched **and** unmatched ingredients (the `decomposed` lookup is hoisted out of the `if (matchInfo)` branch).
- [ ] The orchestrator's `counters` block (the input to `buildPipelineRunRow` from Chunk 1d) fills `densityEnvelopeFires`, `macroInconsistentFires`, and `cookedToRawFactorFires` from the live anomaly stream and `assembleResult` metrics. Field names are camelCase to match `BuildPipelineRunRowInput.counters`; the underlying snake_case columns (`density_envelope_fires`, `macro_inconsistent_fires`, `cooked_to_raw_factor_fires`) come from the Drizzle schema in Chunk 1d.
- [ ] `assembleResult` no longer calls `convertCookedToRaw` when `match.dbState === 'cooked'`; the as-eaten `estimatedGrams` is used directly for DB scaling. `assembleResult` returns `{ result, metrics: { cookedToRawFactorFires } }` (or equivalent instrumentation channel matching the Chunk 1d wiring).
- [ ] `nutrition.ts` no longer imports `convertCookedToRaw`. The XML emits `as_eaten_grams=` (not `raw_grams=`) and `<per_100g …/>` (not `<per_100g_raw …/>`). The `<calculation>` block branches on `db_state ∈ {cooked, raw, unknown}`.
- [ ] The retry loop fires on `density_envelope` and `macro_inconsistent` warnings without escalating yet (escalation lands in Chunk 5 §4.2).
- [ ] All Chunk 2 sentinel tests still pass — no preference-shaped strings reintroduced.
- [ ] `convertCookedToRaw` and `COOKED_TO_RAW_FACTOR` are still exported from `constants.ts`. Live callers post-Chunk-3: `assembly.ts` (gated fallback for `dbState !== 'cooked'`) and `validation.ts` line ~105 (DB-deviation comparator — kept as a sanity baseline, retire alongside the spec §1.5 fire-rate gate). `nutrition.ts` no longer calls it.

**User-facing behavior change:** for cooked-DB-row matches (most cooked-rice/cooked-meat rows in FAO Vietnam), the live nutrition values stop being silently undercounted. End-user totals shift upward for those meals — this is the spec §0.2 correctness fix landing.

---

## Chunk 4 — §5 Eval flywheel: KPI rollup + post-launch shadow runner

**Spec sections:** §5.1 KPI rollup queries · §5.2 Shadow A/B runner · Decision B (5% static sampling).

**Why now:** Chunks 1–3 wrote the substrate (`pipeline_runs` rows with versioning, anomaly counters, prompt-personalization audit). Nothing yet *reads* those rows. Chunk 4 ships the read side: a hand-runnable KPI script for ad-hoc review, plus a feature-flagged shadow runner that captures paired primary/candidate output for **future** prompt/model/schema changes. The shadow runner is **off by default**; turning it on is its own decision after this chunk lands.

**Outcome:** `scripts/eval-kpis.sql` runnable via `psql`/Studio; new `pipeline_shadow_runs` table with paired output; `lib/ai/pipeline/shadow-runner.ts` invoked best-effort *after* the primary response is sent; deterministic 5% sampling; abort guards for primary-degradation, DB-pool wait, and embedding rate-limit; divergence query template. No primary-flow latency cost when the flag is off (the post-response hook is a no-op short-circuit). No paired-input store — per Decision A, raw input lives in `pipeline_requests` (separate worktree owns `pipeline_llm_outputs`).

**Out of scope for this chunk (locked decisions):**
- `pipeline_llm_outputs` raw-LLM-output logging — owned by the debug-dashboard worktree.
- Adaptive sampling rate — Decision B locked at static 5%.
- Real alerting / paging — spec §5.1 explicitly defers to "visible-when-reviewed" until a need is demonstrated.
- Driving any §1/§3 ship decision off shadow output — pre-production status, the runner is **future** regression infrastructure only.

**LOC estimate:** ~700 (new SQL script ~120; new Drizzle table + migration ~60; shadow runner module + tests ~350; orchestrator wiring ~80; abort-guard module + tests ~90).

---

### Task 4.1: `scripts/eval-kpis.sql` — manually-run KPI rollups

- [ ] **Step 1: Create the SQL file with one labeled block per KPI**

Create `scripts/eval-kpis.sql`. The file is a **document**, not a migration — it lives alongside `scripts/backfill_embeddings.ts` and is run by hand against the analytics DB. Each block is independently re-runnable. Use 7-day rolling windows by default; spec §5.1 names them all explicitly.

```sql
-- scripts/eval-kpis.sql
--
-- Manually-run KPI rollups over `pipeline_runs`. Each block is
-- independent and is intended to be pasted into psql / Drizzle
-- Studio / Supabase SQL Editor. No alerting; this is a
-- "visible-when-reviewed" surface per spec §5.1.
--
-- Conventions:
--   - 7-day rolling window unless otherwise noted.
--   - Group by (model_call2, nutrition_prompt_version) so that
--     a prompt or model bump is immediately visible.
--   - All `_fires` columns are smallint counters from §0.4.

-- 1. Latency percentiles per (model, prompt version).
SELECT
  model_call2,
  nutrition_prompt_version,
  count(*)                                                   AS n,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY total_ms)     AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms)     AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY total_ms)     AS p99_ms
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 2. Anomaly rate per AnomalyType per (model, prompt version).
WITH unnested AS (
  SELECT
    model_call2,
    nutrition_prompt_version,
    unnest(anomaly_types) AS anomaly_type
  FROM pipeline_runs
  WHERE created_at >= now() - interval '7 days'
)
SELECT
  model_call2,
  nutrition_prompt_version,
  anomaly_type,
  count(*) AS fires,
  count(*)::numeric
    / nullif(
        (SELECT count(*) FROM pipeline_runs
         WHERE created_at >= now() - interval '7 days'), 0)
    AS rate
FROM unnested
GROUP BY 1, 2, 3
ORDER BY 1, 2, 4 DESC;

-- 3. Escalation, cache-hit, retry rates.
SELECT
  count(*) AS n,
  avg(case when escalated then 1 else 0 end)        AS escalation_rate,
  avg(case when cache_hit_l4 then 1 else 0 end)     AS cache_hit_rate,
  avg(case when retry_count > 0 then 1 else 0 end)  AS retry_rate,
  avg(case when retry_step2_count > 0 then 1 else 0 end)
                                                    AS step2_retry_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 4. Match-quality rates per ingredient.
SELECT
  sum(unmatched_count)::numeric
    / nullif(sum(ingredient_count), 0)              AS unmatched_rate,
  sum(pre_match_alias_hits)::numeric
    / nullif(sum(ingredient_count), 0)              AS alias_hit_rate,
  sum(cooked_to_raw_factor_fires)::numeric
    / nullif(sum(matched_count), 0)                 AS cooked_to_raw_fire_rate,
  sum(density_envelope_fires)::numeric
    / nullif(sum(ingredient_count), 0)              AS density_envelope_rate,
  sum(macro_inconsistent_fires)::numeric
    / nullif(sum(ingredient_count), 0)              AS macro_inconsistent_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 5. db_state coverage — Principle B / §0.2.
SELECT
  sum(db_state_unknown_fires)::numeric
    / nullif(sum(matched_count), 0)                 AS db_state_unknown_rate
FROM pipeline_runs
WHERE created_at >= now() - interval '7 days';

-- 6. Drift watcher — flag any rate moving >2σ from its 7-day baseline.
--    Pure visibility query; no alerting wired.
WITH today AS (
  SELECT
    avg(case when retry_count > 0 then 1.0 else 0 end) AS retry_rate,
    avg(case when escalated     then 1.0 else 0 end)   AS escalation_rate,
    sum(unmatched_count)::numeric / nullif(sum(ingredient_count), 0)
                                                       AS unmatched_rate
  FROM pipeline_runs
  WHERE created_at >= now() - interval '1 day'
), baseline AS (
  SELECT
    avg(case when retry_count > 0 then 1.0 else 0 end)        AS retry_rate_mean,
    stddev_pop(case when retry_count > 0 then 1.0 else 0 end) AS retry_rate_sd,
    avg(case when escalated     then 1.0 else 0 end)          AS escalation_rate_mean,
    stddev_pop(case when escalated     then 1.0 else 0 end)   AS escalation_rate_sd
  FROM pipeline_runs
  WHERE created_at >= now() - interval '7 days'
    AND created_at <  now() - interval '1 day'
)
SELECT
  t.retry_rate,
  b.retry_rate_mean,
  b.retry_rate_sd,
  abs(t.retry_rate - b.retry_rate_mean)
    > 2 * coalesce(b.retry_rate_sd, 0)        AS retry_rate_drift,
  t.escalation_rate,
  b.escalation_rate_mean,
  b.escalation_rate_sd,
  abs(t.escalation_rate - b.escalation_rate_mean)
    > 2 * coalesce(b.escalation_rate_sd, 0)   AS escalation_rate_drift
FROM today t CROSS JOIN baseline b;
```

- [ ] **Step 2: Smoke-test the SQL**

```bash
# Local DB:
bun run db:studio          # paste each block; confirm no syntax errors
# Or directly:
bun --env-file=.env.local -e "
import postgres from 'postgres';
import { encodeDbUrl } from './lib/db';
const sql = postgres(encodeDbUrl(process.env.DATABASE_URL!));
const text = await Bun.file('scripts/eval-kpis.sql').text();
// Strip comments so psql-style block separators aren't needed:
const blocks = text.split(/^-- \\d\\./gm).filter(b => /SELECT|WITH/i.test(b));
for (const b of blocks) await sql.unsafe(b);
console.log('all blocks parsed');
await sql.end();
"
```

A fresh DB will return zero rows (empty table is fine). The script must parse without error against the schema landed in Chunk 1.

- [ ] **Step 3: Document in README**

Add a `scripts/README.md` entry (or extend the existing one) under a "KPI rollups" section pointing at `eval-kpis.sql` and noting the 7-day windows and re-runnable design. One paragraph.

- [ ] **Step 4: Commit**

```bash
git add scripts/eval-kpis.sql scripts/README.md
git commit -m "feat(scripts): add eval-kpis.sql for manual KPI rollups over pipeline_runs

Implements spec §5.1.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.2: `pipeline_shadow_runs` Drizzle table — paired output store

- [ ] **Step 1: Add the schema**

In `lib/db/schema.ts`, add the new table. Keep it minimal: enough to compute divergence (matched IDs, unmatched names, per-ingredient bounded macros, total-macro bounded estimates, anomaly types) and join back to `pipeline_runs.request_id` for context. **No raw input** — that's in `pipeline_requests`.

```ts
export const pipelineShadowRuns = pgTable('pipeline_shadow_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Joins back to pipeline_runs.request_id to recover input context.
  requestId: text('request_id').notNull(),
  // The primary run that this shadow was paired against. Useful for
  // pinning analyses to a specific primary version.
  primaryRunId: uuid('primary_run_id'),
  // Versioning of the *candidate* (shadow) leg.
  candidatePromptVersion: text('candidate_prompt_version').notNull(),
  candidateModel: text('candidate_model').notNull(),
  // Divergence inputs. Both legs are stored as compact JSON so divergence
  // queries can `jsonb_path_query` instead of a wide column zoo.
  primaryOutput: jsonb('primary_output').notNull(),
  candidateOutput: jsonb('candidate_output').notNull(),
  // Pre-computed divergence summary (so the divergence query template
  // is a simple SELECT, not a giant CTE). Fields:
  //   { macroDeltaPct, ingredientCountDelta, anomalyTypeDelta }
  divergence: jsonb('divergence').notNull(),
  // Lifecycle outcome. 'completed' | 'aborted_primary_p95' |
  //   'aborted_pool_wait' | 'aborted_embed_rate_limit' | 'errored'
  outcome: text('outcome').notNull(),
  candidateMs: integer('candidate_ms').notNull().default(0),
});
```

`primaryOutput` / `candidateOutput` JSON shape (typed via Zod in Task 4.4):

```ts
{
  matchedIds: string[];         // canonical DB ingredient IDs that matched
  unmatchedNames: string[];     // ingredient names that fell through
  perIngredientMacros: Array<{  // bounded per-ingredient macros
    ingredientName: string;
    caloriesKcal: { low: number; mid: number; high: number };
    proteinG?:    { low: number; mid: number; high: number };
    carbohydrateG?: { low: number; mid: number; high: number };
    fatG?:        { low: number; mid: number; high: number };
  }>;
  totalMacros: {
    caloriesKcal: { low: number; mid: number; high: number };
    proteinG?:    { low: number; mid: number; high: number };
    carbohydrateG?: { low: number; mid: number; high: number };
    fatG?:        { low: number; mid: number; high: number };
  };
  anomalyTypes: AnomalyType[];
}
```

- [ ] **Step 2: Generate, rename, sanity-check the migration**

```bash
bun db:generate
# rename the migration filename and meta/_journal.json `tag` to:
#   <ts>_add_pipeline_shadow_runs_table
cat supabase/migrations/<ts>_add_pipeline_shadow_runs_table.sql
```

Expected: `CREATE TABLE "pipeline_shadow_runs"` with all columns. No RLS.

- [ ] **Step 3: Manual RLS migration (service-role only)**

`supabase/migrations/<ts+1>_pipeline_shadow_runs_rls.sql`:

```sql
-- pipeline_shadow_runs is system regression infrastructure.
-- Service role only. Never read by the user-facing app.
BEGIN;

ALTER TABLE public.pipeline_shadow_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_shadow_runs FROM authenticated, anon;
GRANT  SELECT, INSERT ON public.pipeline_shadow_runs TO service_role;

CREATE INDEX IF NOT EXISTS idx_pipeline_shadow_runs_created_at
  ON public.pipeline_shadow_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_shadow_runs_request_id
  ON public.pipeline_shadow_runs (request_id);

COMMIT;
```

- [ ] **Step 4: Schema test**

`lib/db/__tests__/schema-shadow-runs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pipelineShadowRuns } from '@/lib/db/schema';

describe('pipelineShadowRuns Drizzle schema', () => {
  it('has the expected columns', () => {
    const cols = Object.keys(pipelineShadowRuns);
    for (const c of [
      'id', 'createdAt', 'requestId', 'primaryRunId',
      'candidatePromptVersion', 'candidateModel',
      'primaryOutput', 'candidateOutput',
      'divergence', 'outcome', 'candidateMs',
    ]) {
      expect(cols).toContain(c);
    }
  });
});
```

Run:
```bash
bun run test lib/db/__tests__/schema-shadow-runs.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts \
        supabase/migrations/<ts>_add_pipeline_shadow_runs_table.sql \
        supabase/migrations/<ts+1>_pipeline_shadow_runs_rls.sql \
        supabase/migrations/meta/_journal.json \
        lib/db/__tests__/schema-shadow-runs.test.ts
git commit -m "feat(db): add pipeline_shadow_runs table for paired A/B output

Spec §5.2. Stores primary + candidate outputs and a pre-computed
divergence summary. RLS service-role only. Joins back to
pipeline_runs.request_id; contains no raw user input.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.3: Sampling decision — deterministic 5% per `request_id`

- [ ] **Step 1: Write the failing test**

`lib/ai/pipeline/__tests__/shadow-sampling.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isShadowSampled,
  SHADOW_SAMPLING_RATE,
} from '../shadow-sampling';

describe('isShadowSampled', () => {
  it('returns false when the feature flag is off', () => {
    expect(isShadowSampled('any-id', { enabled: false })).toBe(false);
  });

  it('returns true for ~5% of request IDs at 0.05 sampling rate', () => {
    let hits = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      if (isShadowSampled(`req-${i}`, { enabled: true })) hits++;
    }
    // Allow a generous tolerance band: 0.05 ± 0.01.
    expect(hits / N).toBeGreaterThan(0.04);
    expect(hits / N).toBeLessThan(0.06);
  });

  it('is deterministic — same requestId always routes the same way', () => {
    const id = 'req-abc-123';
    const a = isShadowSampled(id, { enabled: true });
    const b = isShadowSampled(id, { enabled: true });
    const c = isShadowSampled(id, { enabled: true });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('exports the locked 0.05 sampling rate', () => {
    expect(SHADOW_SAMPLING_RATE).toBe(0.05);
  });
});
```

Run:
```bash
bun run test lib/ai/pipeline/__tests__/shadow-sampling.test.ts
```
Expected: FAIL — module does not exist.

- [ ] **Step 2: Implement the sampler**

`lib/ai/pipeline/shadow-sampling.ts`:

```ts
import { createHash } from 'node:crypto';

/** Per Decision B (locked): static 5% of traffic, deterministic per request. */
export const SHADOW_SAMPLING_RATE = 0.05 as const;

export interface ShadowSamplingConfig {
  enabled: boolean;
  /** Override for tests. Production should pass nothing and let it default. */
  rate?: number;
}

/**
 * Deterministic per-`requestId` sampling. SHA-256 the request id, take the
 * first 4 bytes as an unsigned int, divide by 2^32. Routes consistently
 * across retries within a single request because the request_id is generated
 * once at pipeline start (logging.ts).
 */
export function isShadowSampled(
  requestId: string,
  config: ShadowSamplingConfig
): boolean {
  if (!config.enabled) return false;
  const rate = config.rate ?? SHADOW_SAMPLING_RATE;
  const hash = createHash('sha256').update(requestId).digest();
  const u32 = hash.readUInt32BE(0);
  return u32 / 0x1_0000_0000 < rate;
}
```

Run the test again. Expected: PASS.

- [ ] **Step 3: Surface the feature flag**

The flag itself lives in env / runtime config, not a constant. Read it in the orchestrator (Task 4.4) via `process.env.SHADOW_RUNNER_ENABLED === 'true'`. Default off.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/pipeline/shadow-sampling.ts \
        lib/ai/pipeline/__tests__/shadow-sampling.test.ts
git commit -m "feat(pipeline): add deterministic 5% shadow sampling

Per Decision B. SHA-256 of request_id keyed against SHADOW_SAMPLING_RATE.
Defaults off via SHADOW_RUNNER_ENABLED env flag.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.4: Shadow runner — post-response candidate execution + paired persist

- [ ] **Step 1: Write the failing tests**

`lib/ai/pipeline/__tests__/shadow-runner.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineResponse } from '../../types';
import {
  runShadow,
  runShadowAsync,
  type ShadowRunnerDeps,
  type ShadowGuard,
} from '../shadow-runner';

/**
 * Build a minimally-valid `PipelineResponse` success branch. Returns the full
 * discriminated-union shape (NOT a flat `{ totalCalories, ingredients }`).
 * Only `caloriesMid` and one `ingredientName` per item are configurable —
 * everything else is filled in with neutral defaults so the divergence
 * summarizer's accessor helpers have something to read.
 */
function makePipelineResponse(args: {
  caloriesMid: number;
  ingredientNames: string[];
  success?: true;
}): PipelineResponse;
function makePipelineResponse(args: { success: false }): PipelineResponse;
function makePipelineResponse(args: any): PipelineResponse {
  if (args.success === false) {
    return {
      success: false,
      error: { type: 'api_error', message: 'fixture failure', retryable: true },
    };
  }
  const cal = args.caloriesMid as number;
  const ingredientNames = args.ingredientNames as string[];
  const bn = (mid: number) => ({
    caloriesKcal: { low: mid * 0.9, mid, high: mid * 1.1 },
    proteinG: { low: 0, mid: 0, high: 0 },
    carbsG: { low: 0, mid: 0, high: 0 },
    fatG: { low: 0, mid: 0, high: 0 },
  });
  const nv = { caloriesKcal: cal, proteinG: 0, carbsG: 0, fatG: 0 };
  return {
    success: true,
    data: {
      mealItems: [
        {
          name: 'meal-1',
          ingredients: ingredientNames.map((n, i) => ({
            ingredientName: n,
            foodCompositionId: `id-${i}`,
            estimatedGrams: 100,
            rawEquivalentGrams: 100,
            cookingMethod: null,
            userFacingUnit: null,
            matchConfidence: 0.9,
            boundedNutrition: bn(cal / ingredientNames.length),
            displayedNutrition: nv,
          })),
          boundedNutrition: bn(cal),
          displayedNutrition: nv,
        },
      ],
      mealSlot: null,
      confidenceOverall: 'medium',
      boundedNutrition: bn(cal),
      displayedNutrition: nv,
      unmatchedIngredients: [],
    },
  };
}

const primary = makePipelineResponse({
  caloriesMid: 500,
  ingredientNames: ['thịt bò bắp', 'bánh phở'],
});

describe('runShadow', () => {
  let deps: ShadowRunnerDeps;

  beforeEach(() => {
    deps = {
      runCandidate: vi.fn().mockResolvedValue(
        makePipelineResponse({
          caloriesMid: 520,
          ingredientNames: ['thịt bò bắp', 'bánh phở'],
        })
      ),
      persistShadowRun: vi.fn().mockResolvedValue(undefined),
      now: () => 1000,
    };
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists a row with outcome="completed" on the happy path', async () => {
    await runShadow({
      requestId: 'req-1',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
      primaryRunId: 'run-1',
    }, deps);

    expect(deps.persistShadowRun).toHaveBeenCalledOnce();
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.outcome).toBe('completed');
    expect(row.requestId).toBe('req-1');
    expect(row.primaryRunId).toBe('run-1');
    // Macro delta = |520 - 500| / 500 = 0.04 → under 30% threshold.
    expect(row.divergence.macroDeltaPct).toBeCloseTo(0.04, 2);
    expect(row.divergence.ingredientCountDelta).toBe(0);
  });

  it('records macro divergence > 30% when present', async () => {
    deps.runCandidate = vi.fn().mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 800,
        ingredientNames: ['thịt bò bắp', 'bánh phở'],
      })
    );
    await runShadow({
      requestId: 'req-2',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps);
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.divergence.macroDeltaPct).toBeGreaterThan(0.30);
  });

  it('records ingredient-count delta', async () => {
    deps.runCandidate = vi.fn().mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 500,
        ingredientNames: ['thịt bò bắp'], // candidate dropped one.
      })
    );
    await runShadow({
      requestId: 'req-3',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps);
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.divergence.ingredientCountDelta).toBe(-1);
  });

  it('persists outcome="errored" when the candidate run throws', async () => {
    deps.runCandidate = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(runShadow({
      requestId: 'req-4',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps)).resolves.toBeUndefined();
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.outcome).toBe('errored');
  });

  it('records candidate failure in divergence (success=false branch)', async () => {
    deps.runCandidate = vi.fn().mockResolvedValue(
      makePipelineResponse({ success: false })
    );
    await runShadow({
      requestId: 'req-fail-cand',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps);
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.outcome).toBe('completed'); // candidate didn't throw, just returned !success
    expect(row.divergence.candidateFailed).toBe(true);
  });

  it('handles a failed primary without throwing', async () => {
    const failedPrimary = makePipelineResponse({ success: false });
    await expect(runShadow({
      requestId: 'req-fail-prim',
      primary: failedPrimary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps)).resolves.toBeUndefined();
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.divergence.primaryFailed).toBe(true);
  });

  it('never throws — primary user response must not be perturbed', async () => {
    deps.runCandidate = vi.fn().mockRejectedValue(new Error('boom'));
    deps.persistShadowRun = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(runShadow({
      requestId: 'req-5',
      primary,
      candidatePromptVersion: 'v3',
      candidateModel: 'gemini-2.5-pro',
    }, deps)).resolves.toBeUndefined();
  });
});

describe('runShadowAsync (guard wrapper)', () => {
  function makeGuard(decision: { run: boolean; reason?: string }): ShadowGuard {
    return {
      shouldRun: vi.fn().mockResolvedValue(decision),
      onPrimaryComplete: vi.fn(),
    };
  }
  let deps: ShadowRunnerDeps;
  beforeEach(() => {
    deps = {
      runCandidate: vi.fn().mockResolvedValue(
        makePipelineResponse({
          caloriesMid: 510,
          ingredientNames: ['thịt bò bắp'],
        })
      ),
      persistShadowRun: vi.fn().mockResolvedValue(undefined),
      now: () => 0,
    };
  });

  it.each([
    ['aborted_primary_p95'],
    ['aborted_pool_wait'],
    ['aborted_embed_rate_limit'],
  ] as const)('persists outcome=%s when guard returns that reason', async (reason) => {
    const guard = makeGuard({ run: false, reason });
    await runShadowAsync(
      {
        requestId: 'req-abort',
        primary,
        candidatePromptVersion: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps,
      guard
    );
    expect(deps.runCandidate).not.toHaveBeenCalled();
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.outcome).toBe(reason);
    expect(row.candidateOutput).toBeNull();
  });

  it('delegates to runShadow when guard says run', async () => {
    const guard = makeGuard({ run: true });
    await runShadowAsync(
      {
        requestId: 'req-go',
        primary,
        candidatePromptVersion: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps,
      guard
    );
    expect(deps.runCandidate).toHaveBeenCalledOnce();
    const row = (deps.persistShadowRun as any).mock.calls[0][0];
    expect(row.outcome).toBe('completed');
  });

  it('swallows guard.shouldRun() errors and never throws', async () => {
    const guard: ShadowGuard = {
      shouldRun: vi.fn().mockRejectedValue(new Error('guard down')),
      onPrimaryComplete: vi.fn(),
    };
    await expect(runShadowAsync(
      {
        requestId: 'req-guard-err',
        primary,
        candidatePromptVersion: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps,
      guard
    )).resolves.toBeUndefined();
  });
});
```

The fixture `makePipelineResponse` is defined inline at the top of the test file (above). It must build a real `PipelineResponse` discriminated-union value — `{ success: true, data: PipelineResult }` for success and `{ success: false, error }` for failure — because the divergence summarizer's accessor helpers branch on `.success`. **Do not** ship the divergence module assuming flat `totalCalories` / `ingredients` fields; those do not exist on `PipelineResponse` (verified at `lib/ai/types.ts:209`).

Run:
```bash
bun run test lib/ai/pipeline/__tests__/shadow-runner.test.ts
```
Expected: FAIL — module does not exist.

- [ ] **Step 2: Implement the shadow runner**

`lib/ai/pipeline/shadow-runner.ts`:

```ts
import { computeDivergence, type ShadowDivergence } from './shadow-divergence';
import type {
  PipelineResponse,
  PipelineResult,
  ProcessedIngredient,
} from '../types';

/**
 * Compact paired-output snapshot persisted into `pipeline_shadow_runs.{primary,candidate}_output`.
 * Wire format declared in Task 4.2; this is its TS counterpart.
 */
export interface ShadowOutputSnapshot {
  success: boolean;
  matchedIds: string[];
  unmatchedNames: string[];
  perIngredient: Array<{
    ingredientName: string;
    foodCompositionId: string | null;
    estimatedGrams: number;
    caloriesMid: number;
  }>;
  total: {
    caloriesMid: number;
    proteinMid: number;
    carbsMid: number;
    fatMid: number;
  };
  errorType?: string; // populated only when success === false
}

export interface ShadowRunnerInput {
  requestId: string;
  primary: PipelineResponse;
  primaryRunId?: string;
  candidatePromptVersion: string;
  candidateModel: string;
}

export type ShadowOutcome =
  | 'completed'
  | 'errored'
  | 'aborted_primary_p95'
  | 'aborted_pool_wait'
  | 'aborted_embed_rate_limit';

export interface ShadowRunPersistRow {
  requestId: string;
  primaryRunId: string | null;
  candidatePromptVersion: string;
  candidateModel: string;
  primaryOutput: ShadowOutputSnapshot;
  candidateOutput: ShadowOutputSnapshot | null;
  divergence: ShadowDivergence;
  outcome: ShadowOutcome;
  candidateMs: number;
}

export interface ShadowRunnerDeps {
  runCandidate: (requestId: string) => Promise<PipelineResponse>;
  persistShadowRun: (row: ShadowRunPersistRow) => Promise<void>;
  now: () => number;
}

export interface ShadowGuard {
  /**
   * Resolves immediately before a shadow run. If `run: false`, the wrapper
   * persists an aborted row and skips the candidate entirely.
   */
  shouldRun: () => Promise<
    | { run: true }
    | { run: false; reason: 'aborted_primary_p95' | 'aborted_pool_wait' | 'aborted_embed_rate_limit' }
  >;
  onPrimaryComplete: (primaryMs: number) => void;
}

const EMPTY_SNAPSHOT = (errorType: string): ShadowOutputSnapshot => ({
  success: false,
  matchedIds: [],
  unmatchedNames: [],
  perIngredient: [],
  total: { caloriesMid: 0, proteinMid: 0, carbsMid: 0, fatMid: 0 },
  errorType,
});

function snapshot(r: PipelineResponse): ShadowOutputSnapshot {
  if (!r.success) {
    return EMPTY_SNAPSHOT(r.error.type);
  }
  const data: PipelineResult = r.data;
  const allIngredients: ProcessedIngredient[] = data.mealItems.flatMap(
    (m) => m.ingredients
  );
  const matchedIds = allIngredients
    .map((i) => i.foodCompositionId)
    .filter((id): id is string => id !== null);
  const unmatchedNames = data.unmatchedIngredients.map((u) => u.ingredientName);
  return {
    success: true,
    matchedIds,
    unmatchedNames,
    perIngredient: allIngredients.map((i) => ({
      ingredientName: i.ingredientName,
      foodCompositionId: i.foodCompositionId,
      estimatedGrams: i.estimatedGrams,
      caloriesMid: i.boundedNutrition.caloriesKcal.mid,
    })),
    total: {
      caloriesMid: data.boundedNutrition.caloriesKcal.mid,
      proteinMid: data.boundedNutrition.proteinG.mid,
      carbsMid: data.boundedNutrition.carbsG.mid,
      fatMid: data.boundedNutrition.fatG.mid,
    },
  };
}

/**
 * Best-effort, never-throws candidate execution called AFTER the primary
 * response is delivered to the user.
 */
export async function runShadow(
  input: ShadowRunnerInput,
  deps: ShadowRunnerDeps
): Promise<void> {
  const start = deps.now();
  let outcome: ShadowOutcome = 'completed';
  let candidate: PipelineResponse | null = null;
  try {
    candidate = await deps.runCandidate(input.requestId);
  } catch {
    outcome = 'errored';
  }

  const row: ShadowRunPersistRow = {
    requestId: input.requestId,
    primaryRunId: input.primaryRunId ?? null,
    candidatePromptVersion: input.candidatePromptVersion,
    candidateModel: input.candidateModel,
    primaryOutput: snapshot(input.primary),
    candidateOutput: candidate ? snapshot(candidate) : null,
    divergence: computeDivergence(input.primary, candidate),
    outcome,
    candidateMs: deps.now() - start,
  };

  try {
    await deps.persistShadowRun(row);
  } catch {
    console.warn(
      '[shadow-runner] persist failed',
      { requestId: input.requestId }
    );
  }
}

/**
 * Guard-aware wrapper. If the guard says no, persists an `aborted_*` row
 * with `candidateOutput: null` and `candidateMs: 0` and skips the candidate
 * run entirely. Otherwise delegates to {@link runShadow}.
 *
 * Like {@link runShadow}, this never throws — primary path latency must be
 * unaffected by anything in this module.
 */
export async function runShadowAsync(
  input: ShadowRunnerInput,
  deps: ShadowRunnerDeps,
  guard: ShadowGuard
): Promise<void> {
  let decision: Awaited<ReturnType<ShadowGuard['shouldRun']>>;
  try {
    decision = await guard.shouldRun();
  } catch {
    // A failing guard MUST NOT poison the user's primary response.
    return;
  }

  if (!decision.run) {
    const row: ShadowRunPersistRow = {
      requestId: input.requestId,
      primaryRunId: input.primaryRunId ?? null,
      candidatePromptVersion: input.candidatePromptVersion,
      candidateModel: input.candidateModel,
      primaryOutput: snapshot(input.primary),
      candidateOutput: null,
      divergence: computeDivergence(input.primary, null),
      outcome: decision.reason,
      candidateMs: 0,
    };
    try {
      await deps.persistShadowRun(row);
    } catch {
      console.warn(
        '[shadow-runner] aborted-row persist failed',
        { requestId: input.requestId, reason: decision.reason }
      );
    }
    return;
  }

  return runShadow(input, deps);
}
```

`lib/ai/pipeline/shadow-divergence.ts`:

```ts
import type { PipelineResponse } from '../types';

export interface ShadowDivergence {
  /** |candidateCal − primaryCal| / primaryCal (mid values). 0 if either side missing. */
  macroDeltaPct: number;
  /** candidateIngredientCount − primaryIngredientCount. 0 if either side failed. */
  ingredientCountDelta: number;
  /** Reserved for §4 anomaly-type set diff once anomalies are reified on PipelineResponse. */
  anomalyTypeDelta: string[];
  /** Set when primary returned `{ success: false }`. */
  primaryFailed: boolean;
  /** Set when candidate returned `{ success: false }` (but did not throw). */
  candidateFailed: boolean;
}

/** Total mid calories across the meal, or null if the response failed. */
function totalCalMid(r: PipelineResponse): number | null {
  return r.success ? r.data.boundedNutrition.caloriesKcal.mid : null;
}

/** Sum of ingredients across all meal items, or 0 if the response failed. */
function ingredientCount(r: PipelineResponse): number {
  return r.success
    ? r.data.mealItems.reduce((n, m) => n + m.ingredients.length, 0)
    : 0;
}

export function computeDivergence(
  primary: PipelineResponse,
  candidate: PipelineResponse | null
): ShadowDivergence {
  const primaryFailed = !primary.success;
  const candidateFailed = candidate !== null && !candidate.success;

  if (candidate === null) {
    return {
      macroDeltaPct: 0,
      ingredientCountDelta: 0,
      anomalyTypeDelta: [],
      primaryFailed,
      candidateFailed: false,
    };
  }

  const pCal = totalCalMid(primary);
  const cCal = totalCalMid(candidate);
  const macroDeltaPct =
    pCal !== null && cCal !== null && pCal > 0
      ? Math.abs(cCal - pCal) / pCal
      : 0;
  return {
    macroDeltaPct,
    ingredientCountDelta:
      ingredientCount(candidate) - ingredientCount(primary),
    anomalyTypeDelta: [], // populated when anomaly fields are wired into PipelineResponse
    primaryFailed,
    candidateFailed,
  };
}
```

**Verified field paths against `lib/ai/types.ts:209`:**
- `PipelineResponse` is a discriminated union: `{ success: true; data: PipelineResult } | { success: false; error: PipelineError }`.
- `PipelineResult.boundedNutrition.caloriesKcal.{low, mid, high}` is the canonical total-calories accessor.
- `PipelineResult.mealItems[].ingredients` (`ProcessedIngredient[]`) is where matched ingredients live; `foodCompositionId: string | null` distinguishes matched from unmatched-but-emitted.
- `PipelineResult.unmatchedIngredients` is the canonical unmatched list — separate from the per-meal ingredient array.

Do **not** read `primary.totalCalories` or `primary.ingredients` — neither exists on `PipelineResponse`.

- [ ] **Step 3: Refine until tests pass**

```bash
bun run test lib/ai/pipeline/__tests__/shadow-runner.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/ai/pipeline/shadow-runner.ts \
        lib/ai/pipeline/shadow-divergence.ts \
        lib/ai/pipeline/__tests__/shadow-runner.test.ts
git commit -m "feat(pipeline): add shadow runner module + divergence summarizer

Spec §5.2. Best-effort post-response candidate run; never throws;
divergence summary stored alongside paired output.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.5: Abort guards — primary p95, DB pool wait, embedding rate-limit

- [ ] **Step 1: Write the failing tests**

`lib/ai/pipeline/__tests__/shadow-guards.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createShadowGuard,
  type ShadowGuardClock,
} from '../shadow-guards';

describe('createShadowGuard', () => {
  it('admits the first run', async () => {
    const guard = createShadowGuard({ clock: makeClock(0) });
    expect(await guard.shouldRun()).toEqual({ run: true });
  });

  it('blocks for 30 minutes when primary p95 exceeds threshold', async () => {
    const clock = makeClock(0);
    const p95Source = { value: 5_000 }; // mutable so the test can heal it
    const guard = createShadowGuard({
      clock,
      primaryP95Ms: () => p95Source.value, // observed
      primaryP95ThresholdMs: 4_000,        // limit
    });
    const a = await guard.shouldRun();
    expect(a).toEqual({ run: false, reason: 'aborted_primary_p95' });

    clock.advance(29 * 60_000);
    expect(await guard.shouldRun()).toMatchObject({
      run: false, reason: 'aborted_primary_p95'
    });

    clock.advance(2 * 60_000); // total 31 min, lockout has elapsed
    p95Source.value = 3_000;   // metric has healed (under threshold)
    expect((await guard.shouldRun()).run).toBe(true);
  });

  it('skips one run if DB pool wait is high (no cooldown)', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      dbPoolWaitMs: () => 1_500,
      dbPoolWaitThresholdMs: 1_000,
    });
    expect(await guard.shouldRun()).toMatchObject({
      run: false, reason: 'aborted_pool_wait'
    });
    // Subsequent calls re-evaluate (no 30-min lockout).
    // Simulate pool recovering:
    const guard2 = createShadowGuard({
      clock: makeClock(0),
      dbPoolWaitMs: () => 200,
      dbPoolWaitThresholdMs: 1_000,
    });
    expect((await guard2.shouldRun()).run).toBe(true);
  });

  it('skips one run on embedding rate-limit error', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      embeddingRateLimited: () => true,
    });
    expect(await guard.shouldRun()).toMatchObject({
      run: false, reason: 'aborted_embed_rate_limit'
    });
  });
});

function makeClock(start: number): ShadowGuardClock & { advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
  };
}
```

Run:
```bash
bun run test lib/ai/pipeline/__tests__/shadow-guards.test.ts
```
Expected: FAIL.

- [ ] **Step 2: Implement guards**

`lib/ai/pipeline/shadow-guards.ts`:

```ts
export interface ShadowGuardClock {
  now: () => number;
}

export interface ShadowGuardConfig {
  clock?: ShadowGuardClock;
  primaryP95Ms?: () => number;
  primaryP95ThresholdMs?: number;
  dbPoolWaitMs?: () => number;
  dbPoolWaitThresholdMs?: number;
  embeddingRateLimited?: () => boolean;
}

const PRIMARY_P95_COOLDOWN_MS = 30 * 60_000;

export type ShadowGuardDecision =
  | { run: true }
  | { run: false; reason:
      | 'aborted_primary_p95'
      | 'aborted_pool_wait'
      | 'aborted_embed_rate_limit' };

export function createShadowGuard(cfg: ShadowGuardConfig = {}) {
  const clock = cfg.clock ?? { now: () => Date.now() };
  let primaryP95LockUntil = 0;

  function shouldRun(): Promise<ShadowGuardDecision> {
    const t = clock.now();
    if (t < primaryP95LockUntil) {
      return Promise.resolve({ run: false, reason: 'aborted_primary_p95' });
    }
    const p95 = cfg.primaryP95Ms?.();
    if (
      typeof p95 === 'number' &&
      typeof cfg.primaryP95ThresholdMs === 'number' &&
      p95 > cfg.primaryP95ThresholdMs
    ) {
      primaryP95LockUntil = t + PRIMARY_P95_COOLDOWN_MS;
      return Promise.resolve({ run: false, reason: 'aborted_primary_p95' });
    }
    const pool = cfg.dbPoolWaitMs?.();
    if (
      typeof pool === 'number' &&
      typeof cfg.dbPoolWaitThresholdMs === 'number' &&
      pool > cfg.dbPoolWaitThresholdMs
    ) {
      return Promise.resolve({ run: false, reason: 'aborted_pool_wait' });
    }
    if (cfg.embeddingRateLimited?.()) {
      return Promise.resolve({ run: false, reason: 'aborted_embed_rate_limit' });
    }
    return Promise.resolve({ run: true });
  }

  // Time-based unlock: once `clock.now() >= primaryP95LockUntil`, `shouldRun`
  // re-reads the metric provider on its next call. No manual refresh needed —
  // the cooldown auto-expires.
  function onPrimaryComplete(_primaryMs: number): void {
    // Reserved for a future `recordPrimaryDuration` integration so the guard
    // can derive its own rolling p95 instead of receiving one. No-op today.
  }

  return { shouldRun, onPrimaryComplete };
}
```

- [ ] **Step 3: Where the metrics actually come from**

The guard takes injectable metric providers; it does not implement them. In production wire-up (Task 4.6):

- `primaryP95Ms`: a small in-memory rolling-window aggregator over the last 5 minutes of observed `analyzeMeal` durations. Add a tiny `recordPrimaryDuration(ms)` helper alongside the guard module; the orchestrator calls it after `runPipeline` returns.
- `dbPoolWaitMs`: read `postgres.js` connection-acquisition wait via the existing `db` client's stats hook if available; otherwise stub to `() => 0` and add a TODO. The guard is correct either way — the worst case is "no abort fires."
- `embeddingRateLimited`: the cascade matcher already throws on 429. Track a module-level `lastEmbedRateLimitAt: number | null`; reset after 60s. Wire via `setEmbeddingRateLimited(true)` from the embedding client error handler.

The fallback-to-stub posture is intentional — abort guards should be **best-effort additive safety**, never a blocker for shipping the rest of the runner.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/pipeline/shadow-guards.ts \
        lib/ai/pipeline/__tests__/shadow-guards.test.ts
git commit -m "feat(pipeline): add shadow runner abort guards

Spec §5.2. Primary p95 (30-min cooldown), DB pool wait, embedding
rate-limit. Stub-friendly metric providers — guards are additive safety.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.6: Orchestrator wiring — post-response invocation, never blocks user

- [ ] **Step 1: Write the failing test**

Extend `lib/ai/pipeline/__tests__/run-telemetry.test.ts` (the orchestrator-integration block from Task 3.2) with a new `describe('shadow-runner integration')`:

```ts
describe('shadow-runner integration', () => {
  it('does not invoke the shadow runner when SHADOW_RUNNER_ENABLED is unset', async () => {
    const persistShadowRun = vi.fn();
    await runOrchestratorWithFixture({
      // … happy-path fixture …
      shadow: { enabled: false, persistShadowRun },
    });
    expect(persistShadowRun).not.toHaveBeenCalled();
  });

  it('invokes shadow after primary response when sampled in', async () => {
    const persistShadowRun = vi.fn().mockResolvedValue(undefined);
    const onPrimaryResolved = vi.fn();
    await runOrchestratorWithFixture({
      shadow: {
        enabled: true,
        rate: 1.0,            // force-sample for the test
        persistShadowRun,
      },
      onPrimaryResolved,
    });
    // Primary resolves before shadow persists.
    expect(onPrimaryResolved.mock.invocationCallOrder[0])
      .toBeLessThan(persistShadowRun.mock.invocationCallOrder[0]);
  });

  it('shadow failure does not perturb the primary response', async () => {
    const persistShadowRun = vi.fn().mockRejectedValue(new Error('db down'));
    const result = await runOrchestratorWithFixture({
      shadow: { enabled: true, rate: 1.0, persistShadowRun },
    });
    expect(result.response.success).toBe(true);
    if (result.response.success) {
      expect(result.response.data.boundedNutrition.caloriesKcal.mid)
        .toBeGreaterThan(0);
    }
  });

  it('aborts when the guard says no — outcome reflects reason', async () => {
    const persistShadowRun = vi.fn().mockResolvedValue(undefined);
    await runOrchestratorWithFixture({
      shadow: {
        enabled: true,
        rate: 1.0,
        persistShadowRun,
        guard: { primaryP95Ms: () => 99_999, primaryP95ThresholdMs: 4_000 },
      },
    });
    const row = persistShadowRun.mock.calls[0]?.[0];
    expect(row?.outcome).toBe('aborted_primary_p95');
  });
});
```

Run:
```bash
bun run test lib/ai/pipeline/__tests__/run-telemetry.test.ts
```
Expected: FAIL — wiring not in place.

- [ ] **Step 2: Wire into `analyzeMeal`**

In `lib/ai/pipeline/orchestrator.ts`, immediately after the `runPipeline` call resolves and **before** the function returns to the caller, schedule the shadow run as a microtask. Crucially: do NOT `await` it. The primary response goes back to the user; the shadow fires concurrently against a separate concurrency budget.

The shadow surface is **dependency-injected** so tests can force-sample (rate: 1.0) without flakiness and so production stays off-by-default. Add an optional `analyzeMeal` parameter `shadow?: ShadowConfig`:

```ts
// lib/ai/pipeline/orchestrator.ts (additions only)
import { isShadowSampled, type ShadowSamplingConfig } from './shadow-sampling';
import { runShadowAsync, type ShadowGuard, type ShadowRunnerDeps } from './shadow-runner';

export interface ShadowConfig {
  enabled: boolean;
  /** Optional override of {@link SHADOW_SAMPLING_RATE} for tests. */
  rate?: number;
  persistShadowRun: ShadowRunnerDeps['persistShadowRun'];
  guard?: ShadowGuard;
  /** Override defaults; production uses module-level `NUTRITION_*_CANDIDATE` constants. */
  candidatePromptVersion?: string;
  candidateModel?: string;
}

// Inside analyzeMeal, after `const response = await runPipeline(...)` and
// after the `pipeline_runs` row is written:

const shadowCfg = opts?.shadow ?? defaultShadowConfigFromEnv();
if (
  shadowCfg.enabled &&
  isShadowSampled(requestId, {
    enabled: true,
    rate: shadowCfg.rate, // undefined → SHADOW_SAMPLING_RATE
  } satisfies ShadowSamplingConfig)
) {
  void runShadowAsync(
    {
      requestId,
      primary: response,
      primaryRunId: pipelineRunRowId, // see note below on .id availability
      candidatePromptVersion:
        shadowCfg.candidatePromptVersion ?? NUTRITION_PROMPT_VERSION_CANDIDATE,
      candidateModel:
        shadowCfg.candidateModel ?? NUTRITION_MODEL_CANDIDATE,
    },
    {
      runCandidate: (rid) => runPipelineCandidate(rid, /* uses concurrency: 1 */),
      persistShadowRun: shadowCfg.persistShadowRun,
      now: () => Date.now(),
    },
    shadowCfg.guard ?? defaultShadowGuard()
  );
}

return response;

function defaultShadowConfigFromEnv(): ShadowConfig {
  return {
    enabled: process.env.SHADOW_RUNNER_ENABLED === 'true',
    persistShadowRun: persistShadowRunDefault, // module-local default
  };
}
```

> **Note on `pipelineRunRow.id`** *(advisory follow-up to Chunk 1d)*: the orchestrator needs the `pipeline_runs.id` value available **synchronously after primary response**. If `pipelineRuns.id` is server-generated (`defaultRandom()`), the orchestrator must use `.returning({ id: pipelineRuns.id })` on the insert OR pre-generate `id = crypto.randomUUID()` client-side before calling `buildPipelineRunRow`. Verify the Chunk 1d row-builder shape; if it returns the pre-insert payload only, prefer client-side UUID generation so the shadow run has a stable foreign key without an extra round-trip.

`runShadowAsync` is exported from `lib/ai/pipeline/shadow-runner.ts` (Task 4.4 Step 2). The wrapper:
1. Calls `guard.shouldRun()`. If `run: false`, persists a row with `outcome: reason`, `candidateOutput: null`, `candidateMs: 0`, and returns. **Concrete code lives in Task 4.4 Step 2 — do not re-implement here.**
2. Otherwise calls `runShadow(...)` with a `runCandidate` closure that re-runs the pipeline with the candidate versions/model. The candidate run uses a **separate `MATCH_CONCURRENCY` budget** — pass an explicit `concurrency` option through `matchIngredients` (see Step 3 below).
3. Catches everything (including a failing `guard.shouldRun()`). Logs warn on failure. Never throws.

`NUTRITION_PROMPT_VERSION_CANDIDATE` / `NUTRITION_MODEL_CANDIDATE`: module-local constants, env-overridable, defaulting to the production values (so a flag-on-but-unconfigured shadow runner is a no-op pair). Tests override via `shadowCfg.candidatePromptVersion` / `shadowCfg.candidateModel`.

- [ ] **Step 3: Cascade concurrency parameterization**

`lib/ai/matching/cascade.ts:41`:

```ts
const MATCH_CONCURRENCY_DEFAULT = 2;

export interface MatchOptions {
  concurrency?: number;
}

// Replace inline `MATCH_CONCURRENCY` with: opts.concurrency ?? MATCH_CONCURRENCY_DEFAULT.
```

Thread the option through `matchIngredients` so the shadow runner can pass `concurrency: 1` without contending with primary.

- [ ] **Step 4: Run the suite**

```bash
bun run test
bunx @biomejs/biome@2.4.2 check .
```

- [ ] **Step 5: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts \
        lib/ai/matching/cascade.ts \
        lib/ai/pipeline/__tests__/run-telemetry.test.ts
git commit -m "feat(pipeline): wire shadow runner into analyzeMeal post-response

- Microtask-scheduled (never blocks user)
- Separate MATCH_CONCURRENCY budget via new cascade option
- Guard short-circuit persists outcome reason
- Default off via SHADOW_RUNNER_ENABLED env flag

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.7: Divergence query template + final sweep

- [ ] **Step 1: Append divergence templates to `eval-kpis.sql`**

Add a new section at the bottom of `scripts/eval-kpis.sql`:

```sql
-- =====================================================================
-- §5.2 Shadow runner — divergence query templates.
-- These are skeletons; tweak windows / thresholds for the question at hand.
-- =====================================================================

-- 7. Macro-divergence histogram by candidate (model, prompt) pair.
SELECT
  candidate_model,
  candidate_prompt_version,
  count(*)                                                AS n,
  avg((divergence->>'macroDeltaPct')::numeric)            AS mean_macro_delta,
  percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (divergence->>'macroDeltaPct')::numeric)     AS p95_macro_delta,
  count(*) FILTER (
    WHERE (divergence->>'macroDeltaPct')::numeric > 0.30) AS over_30pct
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
  AND outcome = 'completed'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 8. Ingredient-count delta distribution.
SELECT
  (divergence->>'ingredientCountDelta')::int  AS delta,
  count(*)                                    AS n
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
  AND outcome = 'completed'
GROUP BY 1
ORDER BY 1;

-- 9. Abort-outcome breakdown.
SELECT outcome, count(*)
FROM pipeline_shadow_runs
WHERE created_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC;
```

- [ ] **Step 2: Final lint + test sweep**

```bash
bun run test
bunx @biomejs/biome@2.4.2 check .
```

Both must pass clean. If anything fails, fix before commit.

- [ ] **Step 3: Commit**

```bash
git add scripts/eval-kpis.sql
git commit -m "feat(scripts): add shadow-runner divergence query templates

Spec §5.2.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Chunk 4 — outcome verification

After Chunk 4 ships:

- [ ] `scripts/eval-kpis.sql` exists and parses against the live schema. All blocks are independently re-runnable.
- [ ] `pipeline_shadow_runs` table exists with service-role RLS. No end-user code reads it.
- [ ] `lib/ai/pipeline/shadow-sampling.ts` exports `SHADOW_SAMPLING_RATE = 0.05` and a deterministic `isShadowSampled(requestId, config)`. Unit-tested for ~5% hit rate ± 1% over 10k samples.
- [ ] `lib/ai/pipeline/shadow-runner.ts` exports `runShadow(input, deps)` that **never throws**, persists a row with `outcome ∈ {completed, errored, aborted_*}`, and computes `divergence: { macroDeltaPct, ingredientCountDelta, anomalyTypeDelta }`.
- [ ] `lib/ai/pipeline/shadow-guards.ts` exports `createShadowGuard(cfg)` with primary-p95 (30-min cooldown), DB-pool-wait (per-call), and embedding-rate-limit (per-call) abort modes. All metric providers are injectable; production wiring may stub them.
- [ ] `lib/ai/matching/cascade.ts` accepts an optional `concurrency` option on `matchIngredients`; default unchanged at 2; shadow callers pass an isolated budget.
- [ ] `analyzeMeal` invokes the shadow runner **only when** `SHADOW_RUNNER_ENABLED === 'true'` AND `isShadowSampled(requestId)` is true. The invocation is microtask-scheduled (never `await`-ed); primary response and `pipeline_runs` row are unchanged whether shadow runs or not.
- [ ] `pipeline_shadow_runs.request_id` joins back to `pipeline_runs.request_id` (and `pipeline_requests.id` for raw-input recovery during the 7-day TTL window). No raw input is duplicated into `pipeline_shadow_runs`.
- [ ] All Chunk 1–3 tests still pass. `bunx @biomejs/biome@2.4.2 check .` clean.

**Behavior change vs. before this chunk:** none for end users. Operationally, KPI rollups are now runnable, and the shadow-runner infrastructure is dormant-but-ready. Turning it on is a separate decision (env flag) handled outside this chunk.

---
