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
