# AI Pipeline Prompt Budget Global Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce AI pipeline prompt/provider cost and improve global-language reliability while preserving the existing streaming, persistence, bounded nutrition, matching, and admin tracing architecture.

**Architecture:** Build on the shipped April 5 pipeline optimization work instead of replacing it. Add guardrails first, then compact runtime IDs and language enforcement, then schema/prompt compression by canary label, then Vertex/provider/caching infrastructure, with admin telemetry and tests at every step.

**Tech Stack:** Next.js 16 App Router, Bun, TypeScript, React 19, Supabase, Drizzle ORM, postgres.js, Zod 4, Vitest, Biome 2.4.2, `@google/genai`, Server-Sent Events.

---

## Cross-Spec Review Summary

The April 5 Engineer Pattern Optimization spec has largely landed and should be treated as foundation:

- **Streaming is present:** `app/api/analyze-meal/route.ts`, `lib/ai/gemini.ts`, `lib/ai/streaming/types.ts`, `hooks/use-stream-analysis.ts`, and `lib/ai/pipeline/orchestrator.ts` already implement SSE and streaming model calls.
- **Durable pending analyses are present:** `pendingAnalyses` exists in `lib/db/schema.ts`, the route inserts pending results, and `confirmAndSaveMealAction` consumes them transactionally.
- **Meal persistence is present:** `lib/actions/meals.ts` saves, loads, deletes, groups meal items, and derives user identity server-side.
- **Auth and structured errors are present:** `lib/auth.ts` exposes `requireAuthAndProfile`; `lib/errors.ts` defines `AppError` and factories.
- **Observability is present:** `pipelineRequests`, `pipelineStageLogs`, `pipelineLlmCalls`, `pipelineRuns`, and admin request UI exist.
- **Embedding warm-up is present:** `lib/ai/matching/embedding-cache.ts` warms FAO source embeddings on first miss.
- **The main April 5 exclusion that changed is rate limiting:** it was deferred then; it is required now because the internal link may be shared with outsiders.

Implementation must therefore extend current surfaces. Do not rebuild streaming, persistence, or admin tracing from scratch.

## File Structure

### Created

- `lib/ai/language/detect.ts` — input/output language detection and fallback helpers.
- `lib/ai/language/guard.ts` — post-decomposition language mismatch detection.
- `lib/ai/language/__tests__/detect.test.ts` — language detector coverage.
- `lib/ai/language/__tests__/guard.test.ts` — mismatch guard coverage.
- `lib/ai/pipeline/id-sequence.ts` — compact run-scoped ID sequence utilities.
- `lib/ai/pipeline/__tests__/id-sequence.test.ts` — compact ID tests.
- `lib/rate-limit/analysis-guards.ts` — DB-backed guard checks for analysis, replay, shadow, global budget, and in-flight counters.
- `lib/rate-limit/__tests__/analysis-guards.test.ts` — guard policy and cleanup tests.
- `lib/ai/provider/types.ts` — provider interface, usage metadata, generation profile types.
- `lib/ai/provider/developer.ts` — current Developer API implementation behind provider interface.
- `lib/ai/provider/vertex.ts` — Vertex implementation.
- `lib/ai/provider/cache.ts` — explicit context cache key/build/use helpers.
- `lib/ai/provider/__tests__/*.test.ts` — provider/cache tests.
- `lib/ai/prompts/schema.ts` — provider JSON-schema generation and slimming helper.
- `lib/ai/prompts/budget.ts` — prompt budget measurement helper.
- `lib/ai/prompts/__tests__/budget.test.ts` — prompt/schema budget tests.
- `lib/ai/prompts/__tests__/schema-slimming.test.ts` — schema helper tests.
- `docs/ai-pipeline-vertex-cache-governance.md` — provider/cache data-governance note.
- `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md` — canary thresholds that must exist before prompt/provider/cache rollout.

### Modified

- `app/api/analyze-meal/route.ts` — request locale, cheap guard path, rate limits, provider creation, language context.
- `app/[locale]/(app)/admin/requests/[id]/_components/stage-timeline.tsx` — display provider/cache/prompt-budget/language metadata.
- `app/[locale]/(app)/admin/requests/[id]/_components/pipeline-summary.tsx` — display request-level token/cache/guard summaries.
- `app/[locale]/(app)/admin/requests/[id]/actions.ts` — replay guard and provider metadata.
- `hooks/use-stream-analysis.ts` — provisional/reset or buffered language event behavior.
- `lib/ai/gemini.ts` — move current Gemini SDK logic behind provider metadata or adapt to provider interface.
- `lib/ai/mappers.ts` — include profile `preferredLocale` or build AI request context with locale fallback.
- `lib/ai/pipeline/decomposition-stream.ts` — compact `m1` IDs and provisional event support.
- `lib/ai/pipeline/ids.ts` — migrate from UUID-only validation to compact IDs, or delegate to `id-sequence.ts`.
- `lib/ai/pipeline/orchestrator.ts` — language retry, compact IDs, prompt labels, schema helper, provider metadata.
- `lib/ai/pipeline/run-telemetry.ts` — prompt/provider/cache/language fields where aggregate-level.
- `lib/ai/pipeline/schemas.ts` — remove model-generated UUID requirement, adjust ID validators.
- `lib/ai/prompts/decomposition.ts` — compressed prompt, output language, no model-generated IDs.
- `lib/ai/prompts/nutrition.ts` — compact ID echo, smaller instruction text, output-language echo rule.
- `lib/ai/prompts/types.ts` — add language/display context without goal/aggression.
- `lib/ai/streaming/types.ts` — compact ID docs and optional provisional/reset event types.
- `lib/db/schema.ts` — additive guard/provider/cache/prompt-budget metadata tables/columns.
- `lib/admin/queries.ts` — fetch new metadata for admin request pages.
- `lib/validation.ts` — optional locale in meal-analysis request body and cheap spam shape checks.
- `docs/DATA.md`, `docs/DATABASE.md`, `INGREDIENT_MATCHING_ARCHITECTURE.md` — source-neutral language cleanup.

### Verification Commands

- Focused tests: `bun run test <file-or-files>`
- Full practical test sweep: `bun run test`
- Required final check: `bunx @biomejs/biome@2.4.2 check .`
- DB-dependent tests, when needed: `bun --env-file=.env.local vitest run <db-test-files>`

Do not run `bun dev`, `bun run build`, `bun start`, `bun dbr:push`, `bun dbr:reset`, or `bun dbr:reset:nobackfill` unless the user explicitly asks.

---

## Chunk 1: Abuse Guards And Baseline Admin Metadata

### Task 1.1: Add Guard Event Schema And Types

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/rate-limit/analysis-guards.ts`
- Create: `lib/rate-limit/__tests__/analysis-guards.test.ts`

- [ ] **Step 1: Read database docs**

Run no command. Read `docs/DATABASE.md` before any schema or migration work.

- [ ] **Step 2: Write failing tests for guard event row building**

Create `lib/rate-limit/__tests__/analysis-guards.test.ts` with tests for a pure helper that builds blocked-request events without raw input. Hashes must use a keyed HMAC/pepper, not plain SHA-256, so IP hashes are not easy to reverse by dictionary/range enumeration. Add a missing-secret test proving production code fails closed when `ANALYSIS_GUARD_HASH_SECRET` is absent outside tests.

```ts
import { describe, expect, it } from 'vitest';
import { buildAnalysisGuardEvent } from '../analysis-guards';

describe('buildAnalysisGuardEvent', () => {
  it('stores hashed keys and omits raw meal text', () => {
    const row = buildAnalysisGuardEvent({
      userId: 'user-123',
      ip: '203.0.113.9',
      route: '/api/analyze-meal',
      reason: 'per_user_minute',
      retryAfterSeconds: 30,
    });

    expect(row.userIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row).not.toHaveProperty('rawInput');
    expect(row.reason).toBe('per_user_minute');
  });
});
```

- [ ] **Step 3: Run the failing test**

Run: `bun run test lib/rate-limit/__tests__/analysis-guards.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Add pure guard event helper**

Create `lib/rate-limit/analysis-guards.ts`:

```ts
import { createHmac } from 'node:crypto';

export type AnalysisGuardReason =
  | 'per_user_minute'
  | 'per_user_hour'
  | 'per_user_day'
  | 'concurrent_user'
  | 'admin_replay'
  | 'shadow_disabled'
  | 'global_budget'
  | 'provider_pressure'
  | 'spam_preflight';

export interface AnalysisGuardEventInput {
  userId?: string | null;
  ip?: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds?: number | null;
}

export interface AnalysisGuardEventRow {
  userIdHash: string | null;
  ipHash: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds: number | null;
}

function hmac(value: string, secret = process.env.ANALYSIS_GUARD_HASH_SECRET) {
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('ANALYSIS_GUARD_HASH_SECRET is required');
  }

  return createHmac('sha256', secret ?? 'test-only-analysis-guard-hash-secret')
    .update(value)
    .digest('hex');
}

export function buildAnalysisGuardEvent(
  input: AnalysisGuardEventInput
): AnalysisGuardEventRow {
  return {
    userIdHash: input.userId ? hmac(`user:${input.userId}`) : null,
    ipHash: input.ip ? hmac(`ip:${input.ip}`) : null,
    route: input.route,
    reason: input.reason,
    retryAfterSeconds: input.retryAfterSeconds ?? null,
  };
}
```

- [ ] **Step 5: Add Drizzle table**

Add `analysisGuardEvents` to `lib/db/schema.ts` with columns: `id`, `createdAt`, `userIdHash`, `ipHash`, `route`, `reason`, `retryAfterSeconds`. Use text hashes only, no raw input.

- [ ] **Step 6: Generate and review migration**

Run: `bun db:generate`

Rename the migration to a meaningful name such as `<timestamp>_add_analysis_guard_events.sql` and update `supabase/migrations/meta/_journal.json` tag if Drizzle generated a random tag.

Also write a separate manual SQL migration for RLS/policies. These guard tables are server-only operational telemetry: enable RLS and deny direct anon/authenticated client access. Server-side code uses the database/service role path, not client-side Supabase access.

- [ ] **Step 7: Run tests**

Run: `bun run test lib/rate-limit/__tests__/analysis-guards.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts lib/rate-limit/analysis-guards.ts lib/rate-limit/__tests__/analysis-guards.test.ts supabase/migrations
git commit -m "feat: add analysis guard event telemetry"
```

### Task 1.2: Add Cheap Spam Preflight

**Files:**
- Modify: `lib/validation.ts`
- Test: `lib/validation-schemas.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add tests for repeated-character garbage, URLs-only input, and valid meals.

```ts
expect(mealMessageSchema.safeParse({ message: 'aaaaaaaaaaaaaaaaaaaaaaaa' }).success).toBe(false);
expect(mealMessageSchema.safeParse({ message: 'https://example.com' }).success).toBe(false);
expect(mealMessageSchema.safeParse({ message: 'chicken breast with rice' }).success).toBe(true);
```

- [ ] **Step 2: Run focused validation tests**

Run: `bun run test lib/validation-schemas.test.ts`

Expected: FAIL for missing preflight rules.

- [ ] **Step 3: Implement minimal preflight refinements**

In `lib/validation.ts`, add refinements to `mealTextSchema` that reject URL-only text and highly repetitive single-token garbage. Keep normal short meals valid.

- [ ] **Step 4: Run tests**

Run: `bun run test lib/validation-schemas.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts lib/validation-schemas.test.ts
git commit -m "fix: reject obvious spam meal input"
```

### Task 1.3: Add Request-Layer Guard Integration

**Files:**
- Modify: `lib/rate-limit/analysis-guards.ts`
- Modify: `app/api/analyze-meal/route.ts`
- Test: `app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 1: Write route tests for blocked requests**

Mock `checkAnalysisGuards` to return a blocked result. Assert:

- response status is 429
- response is JSON, not SSE
- no Gemini client is created
- no `pipeline_requests` row is created
- retry-after is present

- [ ] **Step 2: Run route tests**

Run: `bun run test app/api/analyze-meal/__tests__/route.test.ts`

Expected: FAIL until guard hook exists.

- [ ] **Step 3: Implement guard result types**

Add to `analysis-guards.ts`:

```ts
export type AnalysisGuardResult =
  | { allowed: true; release?: () => Promise<void> | void }
  | {
      allowed: false;
      status: 429;
      reason: AnalysisGuardReason;
      retryAfterSeconds: number;
    };

export async function checkAnalysisGuards(): Promise<AnalysisGuardResult> {
  return { allowed: true };
}
```

This task only adds the route contract. Task 1.4 implements the real DB-backed quota store before any language, prompt, or provider work begins.

- [ ] **Step 4: Wire guard before `logPipelineStart`**

In `app/api/analyze-meal/route.ts`, after auth/body/profile validation and before `logPipelineStart`, call `checkAnalysisGuards`. On blocked result, insert guard event and return JSON 429.

- [ ] **Step 5: Ensure cleanup on every path**

If `checkAnalysisGuards` returns `release`, call it on every possible exit path:

- validation or logging failure after guard acquisition but before SSE starts
- successful stream completion
- in-stream pipeline error
- request abort / stream close

Add a route test where `logPipelineStart` throws after guard acquisition and assert `release` is called.

- [ ] **Step 6: Run focused tests**

Run: `bun run test app/api/analyze-meal/__tests__/route.test.ts lib/rate-limit/__tests__/analysis-guards.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/analyze-meal/route.ts app/api/analyze-meal/__tests__/route.test.ts lib/rate-limit/analysis-guards.ts lib/rate-limit/__tests__/analysis-guards.test.ts
git commit -m "feat: guard meal analysis before model calls"
```

### Task 1.4: Implement DB-Backed Analysis Route Limits

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/rate-limit/analysis-guards.ts`
- Modify: `lib/rate-limit/__tests__/analysis-guards.test.ts`
- Modify: `app/api/analyze-meal/route.ts`
- Modify: `app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 1: Read database docs**

Read `docs/DATABASE.md` again before adding limiter tables. This is schema work.

- [ ] **Step 2: Write failing policy tests**

Extend `analysis-guards.test.ts` to cover the user-facing meal-analysis route only:

- allowed request creates or increments counters
- concurrent allowed requests cannot exceed quota under race
- per-user minute quota blocks with retry-after
- per-user hour quota blocks
- per-user day quota blocks
- in-flight concurrency blocks when a user already has a running analysis
- `release()` decrements in-flight count exactly once
- repeated `release()` cannot drive in-flight count below zero

- [ ] **Step 3: Run failing tests**

Run: `bun run test lib/rate-limit/__tests__/analysis-guards.test.ts app/api/analyze-meal/__tests__/route.test.ts`

Expected: FAIL until real quota store exists.

- [ ] **Step 4: Add limiter tables**

Add additive Drizzle tables, for example:

- `analysis_rate_limit_windows` keyed by hashed user/IP/global key, window kind, and window start
- `analysis_in_flight_limits` keyed by hashed user key with count and updated time

Store hashed keys only. Do not store raw meal text, raw IP, or raw user context.
Add unique constraints for limiter keys and window starts so acquisitions can use race-safe upsert/transaction semantics across Cloud Run instances.

- [ ] **Step 5: Generate and review migration**

Run: `bun db:generate`

Rename the migration to a meaningful name such as `<timestamp>_add_analysis_rate_limits.sql` and update `supabase/migrations/meta/_journal.json` if needed.

Also write a separate manual SQL migration for RLS/policies. Rate-limit and in-flight tables are server-only operational tables: enable RLS and deny direct anon/authenticated client access.

- [ ] **Step 6: Implement route quota policy math**

Implement DB-backed `checkAnalysisGuards` with configurable env defaults for the meal-analysis route. Keep exact numbers conservative and centralized. Use atomic upsert/transaction semantics for window counters and in-flight acquisition. The helper returns `{ allowed: true, release }` only after all quota checks and in-flight acquisition succeed.

- [ ] **Step 7: Implement guard telemetry on blocks**

Every blocked path writes `analysis_guard_events` with hashed keys, reason, route, and retry-after. It must not write `pipeline_requests`.

- [ ] **Step 8: Run focused tests**

Run: `bun run test lib/rate-limit/__tests__/analysis-guards.test.ts app/api/analyze-meal/__tests__/route.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/db/schema.ts lib/rate-limit/analysis-guards.ts lib/rate-limit/__tests__/analysis-guards.test.ts app/api/analyze-meal/route.ts app/api/analyze-meal/__tests__/route.test.ts supabase/migrations
git commit -m "feat: enforce meal analysis route limits"
```

### Task 1.5: Add Admin Replay Guard

**Files:**
- Modify: `lib/rate-limit/analysis-guards.ts`
- Modify: `app/[locale]/(app)/admin/requests/[id]/actions.ts`
- Modify: `app/[locale]/(app)/admin/requests/__tests__/replay.test.ts`

- [ ] **Step 1: Write failing replay quota tests**

Assert live replay is blocked when admin replay quota is exhausted, dry-run replay remains allowed when configured, no real Gemini call is made on block, and a guard event is written with reason `admin_replay`.

- [ ] **Step 2: Run failing replay tests**

Run: `bun run test app/[locale]/(app)/admin/requests/__tests__/replay.test.ts lib/rate-limit/__tests__/analysis-guards.test.ts`

- [ ] **Step 3: Implement admin replay policy**

Add a specific guard helper for admin live replay. Keep it separate from user meal-analysis quotas so admin tooling cannot consume user quota.

- [ ] **Step 4: Wire replay action**

Call the admin replay guard before creating the real replay Gemini client. Blocked replay returns a structured error and writes guard telemetry.

- [ ] **Step 5: Run tests**

Run the replay and guard tests again.

- [ ] **Step 6: Commit**

```bash
git add lib/rate-limit/analysis-guards.ts app/[locale]/(app)/admin/requests/[id]/actions.ts app/[locale]/(app)/admin/requests/__tests__/replay.test.ts
git commit -m "feat: limit admin pipeline replays"
```

### Task 1.6: Add Shadow, Global Budget, And Provider Pressure Guards

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/rate-limit/analysis-guards.ts`
- Modify: `lib/rate-limit/__tests__/analysis-guards.test.ts`
- Modify: `lib/ai/pipeline/shadow-guards.ts`
- Modify: `lib/ai/pipeline/__tests__/shadow-guards.test.ts`
- Modify: `lib/ai/pipeline/orchestrator.ts` if shadow dispatch needs guard input

- [ ] **Step 1: Write failing nonessential-work guard tests**

Cover shadow quota exhaustion, global daily request/token budget exhaustion, provider pressure env override, and recent provider error-window pressure.

- [ ] **Step 2: Run failing tests**

Run: `bun run test lib/rate-limit/__tests__/analysis-guards.test.ts lib/ai/pipeline/__tests__/shadow-guards.test.ts`

- [ ] **Step 3: Read database docs**

Read `docs/DATABASE.md` before adding budget/provider-pressure storage. This task may require schema and manual RLS migrations.

- [ ] **Step 4: Implement always-on global budget accounting source**

Use an always-on source such as new `pipeline_runs` provider/token columns or a dedicated budget/pressure table. Do not depend on optional `PIPELINE_TRACE_ENABLED` rows for global budget decisions. If new table/columns are needed, add Drizzle schema, run `bun db:generate`, rename the migration meaningfully, and add a separate manual RLS/policy migration for server-only access.

- [ ] **Step 5: Implement provider pressure source semantics**

Support both an env override and a recent provider error-window calculation. Keep the exact window and thresholds configurable. Provider pressure must use an always-on source too, such as provider error/category fields in `pipeline_runs` or a dedicated budget/pressure table; do not depend on optional trace rows. Add tests with tracing disabled.

- [ ] **Step 6: Wire shadow guard path**

Update existing shadow guard/orchestrator logic so shadow runs disable under quota/provider pressure before spending model tokens.

- [ ] **Step 7: Run tests**

Run focused guard and shadow tests.

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema.ts lib/rate-limit/analysis-guards.ts lib/rate-limit/__tests__/analysis-guards.test.ts lib/ai/pipeline/shadow-guards.ts lib/ai/pipeline/__tests__/shadow-guards.test.ts lib/ai/pipeline/orchestrator.ts supabase/migrations
git commit -m "feat: guard shadow runs and global model budget"
```

### Task 1.7: Add Admin Baseline Metadata Placeholders

**Files:**
- Modify: `lib/ai/pipeline/trace.ts`
- Modify: `lib/db/schema.ts`
- Modify: `app/[locale]/(app)/admin/requests/[id]/_components/stage-timeline.tsx`
- Modify: `lib/admin/queries.ts`

- [ ] **Step 1: Read database docs if schema changes are needed**

Read `docs/DATABASE.md` before this task if the chosen metadata storage changes `lib/db/schema.ts`.

- [ ] **Step 2: Add tests or type assertions for metadata shape**

Extend existing trace tests so LLM calls can carry nullable metadata fields: provider, region, cacheStatus, input/output/cached/thought tokens, prompt/schema chars.

- [ ] **Step 3: Add additive DB fields or adjacent metadata table**

Prefer an adjacent `pipeline_llm_call_metadata` table if adding many nullable fields would clutter `pipeline_llm_calls`. Keep the plan minimal: metadata must join by `pipeline_llm_calls.id`.

- [ ] **Step 4: Generate and review migration**

If schema changes were made, run `bun db:generate`, rename the migration meaningfully, and update `supabase/migrations/meta/_journal.json` if needed.

If an adjacent metadata table is added, also write a separate manual SQL migration for RLS/policies. LLM call metadata is server/admin operational data and must not be directly selectable from anon/authenticated Supabase clients.

- [ ] **Step 5: Render metadata if present**

In `stage-timeline.tsx`, show metadata fields only when non-null. Preserve current input/output token display.

- [ ] **Step 6: Run focused admin/trace tests**

Run relevant existing tests around trace and admin request components.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/ai/pipeline/trace.ts lib/admin/queries.ts app/[locale]/(app)/admin/requests/[id]/_components/stage-timeline.tsx supabase/migrations
git commit -m "feat: surface LLM call budget metadata"
```

### Task 1.8: Add Prompt Budget Measurement And Baseline Capture

**Files:**
- Create: `lib/ai/prompts/budget.ts`
- Create: `lib/ai/prompts/__tests__/budget.test.ts`
- Modify: `lib/ai/pipeline/trace.ts`
- Modify: admin request detail components
- Create: `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-baseline.md`

- [ ] **Step 1: Write budget helper tests**

Assert helper splits static prompt, dynamic message/data, schema chars, and approximate token estimate.

- [ ] **Step 2: Run failing tests**

Run: `bun run test lib/ai/prompts/__tests__/budget.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement helper**

Keep it pure and provider-neutral:

```ts
export interface PromptBudget {
  systemChars: number;
  userChars: number;
  schemaChars: number;
  approxTokens: number;
}
```

- [ ] **Step 4: Attach to trace metadata**

Pass prompt budget metadata to existing LLM call trace metadata before any compact ID, language, schema, prompt, provider, or cache behavior changes.

- [ ] **Step 5: Render admin metadata**

Show compact budget fields next to existing token counts.

- [ ] **Step 6: Capture current baseline**

Record current default decomposition prompt, nutrition prompt, schema, provider, and token metadata in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-baseline.md`. This is the comparison point for later canaries.

- [ ] **Step 7: Run tests**

Run focused prompt/admin tests.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/prompts/budget.ts lib/ai/prompts/__tests__/budget.test.ts lib/ai/pipeline/trace.ts app/[locale]/(app)/admin/requests/[id]/_components docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-baseline.md
git commit -m "feat: record AI prompt budget baseline"
```

### Task 1.9: Create Rollout Threshold Checklist Before Canaries

**Files:**
- Create: `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`

- [ ] **Step 1: Create threshold checklist**

Document placeholders to fill before each canary: schema-format token reduction and parse/schema-failure ceilings, prompt token reduction target, dynamic packet token reduction target, p95 latency ceiling, language mismatch rate ceiling, unmatched rate drift, anomaly rate drift, source-distribution drift, retry rate, provider error rate, cache hit/miss expectations, and macro divergence.

- [ ] **Step 2: Reference checklist from canary tasks**

Add a note in this plan's prompt/provider/cache canary tasks that rollout cannot start until the relevant threshold row is filled.

- [ ] **Step 3: Commit checklist**

```bash
git add docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign.md
git commit -m "docs: add AI pipeline rollout thresholds checklist"
```

---

## Chunk 2: Language Contract And Compact IDs

### Task 2.1: Add Language Detection Helpers

**Files:**
- Create: `lib/ai/language/detect.ts`
- Create: `lib/ai/language/__tests__/detect.test.ts`
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/prompts/types.ts`

- [ ] **Step 1: Write failing detector tests**

Cover English, Vietnamese with diacritics, unaccented Vietnamese dish words, mixed text, brands, and unsupported language.

- [ ] **Step 2: Run failing tests**

Run: `bun run test lib/ai/language/__tests__/detect.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement detector**

Create helpers:

```ts
export type SupportedOutputLanguage = 'en' | 'vi';
export type LanguageDetectionReason =
  | 'vietnamese_diacritics'
  | 'vietnamese_food_word'
  | 'english_ascii'
  | 'locale_fallback'
  | 'default_fallback';

export interface LanguageDecision {
  inputLanguage: SupportedOutputLanguage | 'mixed' | 'unknown';
  outputLanguage: SupportedOutputLanguage;
  reason: LanguageDetectionReason;
}
```

Implement conservative heuristics. Do not over-detect `pho bo` as Vietnamese if the phrase is inside a larger English sentence like `pho bo with beef` unless the locale fallback chooses Vietnamese.

- [ ] **Step 4: Extend prompt context type**

Add `outputLanguage` and `inputLanguage` to prompt context types. Keep `goal` and `aggression` excluded.

- [ ] **Step 5: Run tests**

Run: `bun run test lib/ai/language/__tests__/detect.test.ts lib/ai/pipeline/__tests__/prompts.test.ts`

Expected: PASS after updating fixtures as needed.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/language lib/ai/types.ts lib/ai/prompts/types.ts lib/ai/pipeline/__tests__/prompts.test.ts
git commit -m "feat: detect meal output language"
```

### Task 2.2: Pass Locale Into Analyze Route

**Files:**
- Modify: `lib/validation.ts`
- Modify: `app/api/analyze-meal/route.ts`
- Modify: `lib/ai/mappers.ts`
- Tests: `lib/validation-schemas.test.ts`, `app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 1: Write tests for optional locale**

Validate `{ message, locale: 'en' }`, `{ message, locale: 'vi' }`, and reject unsupported locale.

- [ ] **Step 2: Run tests**

Run: `bun run test lib/validation-schemas.test.ts app/api/analyze-meal/__tests__/route.test.ts`

Expected: FAIL until schema/route accept locale.

- [ ] **Step 3: Extend `mealMessageSchema`**

Add optional `locale: z.enum(['en', 'vi']).optional()`.

- [ ] **Step 4: Include profile locale fallback**

Extend `buildUserContext` or add a parallel `buildAiRequestContext` so preferred locale is available for language fallback without allowing it to steer nutrition goals.

- [ ] **Step 5: Run tests**

Run focused tests again.

- [ ] **Step 6: Commit**

```bash
git add lib/validation.ts lib/validation-schemas.test.ts app/api/analyze-meal/route.ts app/api/analyze-meal/__tests__/route.test.ts lib/ai/mappers.ts
git commit -m "feat: pass locale fallback to meal analysis"
```

### Task 2.3: Replace UUID Run IDs With Compact IDs

**Files:**
- Create: `lib/ai/pipeline/id-sequence.ts`
- Create/modify: `lib/ai/pipeline/__tests__/id-sequence.test.ts`
- Modify: `lib/ai/pipeline/ids.ts`
- Modify: `lib/ai/pipeline/decomposition-stream.ts`
- Modify: `lib/ai/pipeline/schemas.ts`
- Modify: `lib/ai/streaming/types.ts`

- [ ] **Step 1: Write failing compact ID tests**

Assert sequence returns `m1`, `m2`, `i1`, `i2`; duplicate names remain distinct; legacy UUIDs can be normalized during migration.

- [ ] **Step 2: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/id-sequence.test.ts lib/ai/pipeline/__tests__/ids.test.ts`

Expected: FAIL until compact ID support exists.

- [ ] **Step 3: Implement ID sequence**

Create `id-sequence.ts` with a tiny sequence class or pure functions. Keep deterministic per-request state.

- [ ] **Step 4: Update schemas**

Remove `.uuid()` requirements for LLM nutrition IDs. Use compact ID regex or non-empty string where migration requires.

- [ ] **Step 5: Update decomposition stream**

Generate compact meal IDs during stream extraction. Thread stream IDs into parsed decomposition.

- [ ] **Step 6: Update streaming type comments**

Replace UUID wording with compact run-scoped ID wording.

- [ ] **Step 7: Run focused pipeline tests**

Run: `bun run test lib/ai/pipeline/__tests__/ids.test.ts lib/ai/pipeline/__tests__/orchestrator*.test.ts lib/ai/streaming/__tests__/encoder.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/pipeline/id-sequence.ts lib/ai/pipeline/ids.ts lib/ai/pipeline/decomposition-stream.ts lib/ai/pipeline/schemas.ts lib/ai/streaming/types.ts lib/ai/pipeline/__tests__ lib/ai/streaming/__tests__
git commit -m "refactor: use compact pipeline run ids"
```

### Task 2.4: Add Language Guard And Streaming Semantics

**Files:**
- Create: `lib/ai/language/guard.ts`
- Create: `lib/ai/language/__tests__/guard.test.ts`
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Modify: `lib/ai/streaming/types.ts`
- Modify: `hooks/use-stream-analysis.ts`
- Create/modify: `hooks/__tests__/use-stream-analysis.test.ts` if the hook behavior changes

- [ ] **Step 1: Use buffered item-name events for first release**

For the first release, buffer `item_name` events until the language guard passes. This is simpler and avoids client event reset churn. Keep streaming `item_macros` unchanged. Provisional/reset events remain a future option only if buffering hurts perceived latency.

- [ ] **Step 2: Write language guard tests**

Cover clear English output, clear Vietnamese output, mismatch, mixed uncertainty, and brand preservation.

- [ ] **Step 3: Run failing tests**

Run: `bun run test lib/ai/language/__tests__/guard.test.ts`

Expected: FAIL until module exists.

- [ ] **Step 4: Implement guard**

Implement a heuristic guard that errs on logging rather than blocking. It returns `{ ok, reason, severity }`.

- [ ] **Step 5: Wire one retry after Call 1 parse**

In `orchestrator.ts`, if guard fails clearly, retry Call 1 once with a short corrective user message. Ensure retry is traced as a separate LLM attempt.

- [ ] **Step 6: Update stream consumer if buffering changes event timing**

If buffering is chosen, no new client event type is required. If provisional/reset is chosen, add event types and client handling.

- [ ] **Step 7: Run tests**

Run: `bun run test lib/ai/language/__tests__/guard.test.ts lib/ai/pipeline/__tests__/orchestrator*.test.ts`

If the hook behavior changes, also create/update `hooks/__tests__/use-stream-analysis.test.ts` and run: `bun run test hooks/__tests__/use-stream-analysis.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/language lib/ai/pipeline/orchestrator.ts lib/ai/streaming/types.ts hooks/use-stream-analysis.ts
# If created or modified by this task:
git add hooks/__tests__/use-stream-analysis.test.ts
git commit -m "feat: enforce meal output language"
```

### Task 2.5: Surface Language Metadata In Admin

**Files:**
- Modify: `lib/ai/pipeline/trace.ts`
- Modify: `lib/ai/pipeline/run-telemetry.ts`
- Modify: `lib/admin/queries.ts`
- Modify: `app/[locale]/(app)/admin/requests/[id]/_components/stage-timeline.tsx`
- Modify: `app/[locale]/(app)/admin/requests/[id]/_components/pipeline-summary.tsx`

- [ ] **Step 1: Write failing metadata tests**

Assert a request with language detection records input language, output language, fallback reason, mismatch result, and retry count.

- [ ] **Step 2: Run focused tests**

Run trace/admin tests and expect failure until metadata is wired.

- [ ] **Step 3: Attach language metadata to trace/run telemetry**

Store language metadata on the existing request/LLM metadata surface from Task 1.7. Prefer additive metadata rows over duplicating columns in multiple tables.

- [ ] **Step 4: Render language metadata in admin**

Show concise language fields in request detail. Include retry count only when non-zero.

- [ ] **Step 5: Run tests**

Run: `bun run test lib/ai/language/__tests__/detect.test.ts lib/ai/language/__tests__/guard.test.ts lib/ai/pipeline/__tests__/trace.test.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/trace.ts lib/ai/pipeline/run-telemetry.ts lib/admin/queries.ts app/[locale]/(app)/admin/requests/[id]/_components
git commit -m "feat: show meal language metadata in admin"
```

---

## Chunk 3: Schema And Prompt Compression

### Task 3.1: Add Schema Slimming Helper

**Files:**
- Create: `lib/ai/prompts/schema.ts`
- Create: `lib/ai/prompts/__tests__/schema-slimming.test.ts`
- Modify: `lib/ai/gemini.ts`

- [ ] **Step 1: Write schema slimming tests**

Assert descriptions are removed, required fields/enums remain, and runtime Zod parse is unchanged.

- [ ] **Step 2: Run failing tests**

Run: `bun run test lib/ai/prompts/__tests__/schema-slimming.test.ts`

- [ ] **Step 3: Implement `toProviderJsonSchema`**

Use Zod 4's `z.toJSONSchema(schema)` output and recursively strip `description` keys unless a keep-list is needed.

- [ ] **Step 4: Wire behind flag/label**

In `gemini.ts` or provider wrapper, choose full vs slim schema by config. Default to full until canary.

- [ ] **Step 5: Confirm threshold checklist entry exists before canary**

Slim schema rollout cannot start until the schema-format row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md` is filled with parse error ceiling, schema validation failure ceiling, token reduction target, p95 latency ceiling, retry rate ceiling, and quality drift review criteria.

- [ ] **Step 6: Run tests**

Run: `bun run test lib/ai/prompts/__tests__/schema-slimming.test.ts lib/ai/__tests__/gemini.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/ai/prompts/schema.ts lib/ai/prompts/__tests__/schema-slimming.test.ts lib/ai/gemini.ts
git commit -m "feat: add slim provider schemas"
```

### Task 3.2: Add Compressed Decomposition Prompt Variant

**Files:**
- Modify: `lib/ai/prompts/decomposition.ts`
- Modify: `lib/ai/pipeline/__tests__/prompts.test.ts`
- Modify: prompt budget tests

- [ ] **Step 1: Add tests for compressed prompt contract**

Assert prompt includes output language, required fields, no UUID examples, no source routing, no goal/aggression, and no large example block.

- [ ] **Step 2: Run tests**

Run: `bun run test lib/ai/pipeline/__tests__/prompts.test.ts lib/ai/prompts/__tests__/budget.test.ts`

- [ ] **Step 3: Add compressed prompt variant behind a label**

Keep the current decomposition prompt as the default. Add a compressed variant behind a prompt label/config. Remove UUID examples and most cuisine-specific examples in the variant. Keep concise global rules, language contract, and compact ID note: IDs are runtime-provided, not model-generated.

- [ ] **Step 4: Run tests and inspect budget output**

Run focused tests. Record before/after budget in test output or comments only if useful.

- [ ] **Step 5: Confirm threshold checklist entry exists**

Before enabling any canary traffic, fill the decomposition prompt row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/prompts/decomposition.ts lib/ai/pipeline/__tests__/prompts.test.ts lib/ai/prompts/__tests__/budget.test.ts
git commit -m "feat: add compressed decomposition prompt variant"
```

### Task 3.3: Add Compressed Nutrition Prompt Variant

**Files:**
- Modify: `lib/ai/prompts/nutrition.ts`
- Modify: `lib/ai/prompts/__tests__/nutrition.test.ts`
- Modify: `lib/ai/pipeline/__tests__/prompts.test.ts`

- [ ] **Step 1: Add tests for ID echo and language echo**

Assert compact IDs appear in dynamic ingredient facts and prompt says names/IDs must be echoed exactly.

- [ ] **Step 2: Run tests**

Run prompt tests and expect failures until prompt is changed.

- [ ] **Step 3: Add compressed nutrition prompt variant behind a label**

Keep the current nutrition prompt as the default. Add a compressed variant behind a prompt label/config. Remove redundant cooking tutorial text in the variant, keep bounded macro contract, DB state guidance, unmatched grouping, ID/name echo, and no preference leakage.

- [ ] **Step 4: Run tests**

Run: `bun run test lib/ai/prompts/__tests__/nutrition.test.ts lib/ai/pipeline/__tests__/prompts.test.ts`

- [ ] **Step 5: Confirm threshold checklist entry exists**

Before enabling canary traffic, fill the nutrition prompt row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/prompts/nutrition.ts lib/ai/prompts/__tests__/nutrition.test.ts lib/ai/pipeline/__tests__/prompts.test.ts
git commit -m "feat: add compressed nutrition prompt variant"
```

### Task 3.4: Add Compact Dynamic Nutrition Facts Packet Variant

**Files:**
- Modify: `lib/ai/prompts/nutrition.ts`
- Modify: `lib/ai/prompts/__tests__/nutrition.test.ts`
- Modify: `lib/ai/prompts/__tests__/budget.test.ts`
- Modify: `lib/ai/pipeline/shadow-runner.ts` if packet labels need shadow comparison

- [ ] **Step 1: Write equivalence tests**

Given the same matched/unmatched ingredients, assert the current XML packet and compact JSON/columnar packet contain the same meal IDs, ingredient IDs, display names, canonical names, grams, source labels, DB states, macro facts, cooking methods, and unmatched grouping.

- [ ] **Step 2: Write budget tests**

Assert the compact packet reports lower or equal prompt budget than XML for representative fixtures.

- [ ] **Step 3: Run failing tests**

Run: `bun run test lib/ai/prompts/__tests__/nutrition.test.ts lib/ai/prompts/__tests__/budget.test.ts`

- [ ] **Step 4: Implement compact packet behind a label**

Keep XML as the default. Add compact packet rendering behind a prompt/data packet label so shadow/admin can compare without changing production behavior.

- [ ] **Step 5: Add admin/shadow label propagation**

Record the data packet label with prompt/provider metadata so canary comparison can separate prompt text changes from dynamic packet format changes.

- [ ] **Step 6: Confirm threshold checklist entry exists**

Before enabling canary traffic, fill the dynamic packet row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`.

- [ ] **Step 7: Run tests**

Run focused nutrition prompt, budget, and shadow-label tests.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/prompts/nutrition.ts lib/ai/prompts/__tests__/nutrition.test.ts lib/ai/prompts/__tests__/budget.test.ts lib/ai/pipeline/shadow-runner.ts
git commit -m "feat: add compact nutrition facts packet variant"
```

---

## Chunk 4: Source-Neutral Cleanup

### Task 4.1: Source-Neutral Docs And Comments

**Files:**
- Modify: `docs/DATA.md`
- Modify: `docs/DATABASE.md`
- Modify: `INGREDIENT_MATCHING_ARCHITECTURE.md`
- Modify comments in touched `lib/ai/matching/*` files only when stale

- [ ] **Step 1: Search for stale Vietnam-only global wording**

Use workspace search for `Vietnamese Food Composition`, `VN FCT`, `Vietnamese users`, and `primary output language is Vietnamese`.

- [ ] **Step 2: Update docs carefully**

Keep Vietnamese-specific wording where it describes FAO Vietnam, diacritic search, or Vietnamese aliases. Use source-neutral wording for global pipeline concepts.

- [ ] **Step 3: Run docs-adjacent checks**

Run Biome check after edits.

- [ ] **Step 4: Commit**

```bash
git add docs/DATA.md docs/DATABASE.md INGREDIENT_MATCHING_ARCHITECTURE.md lib/ai/matching
git commit -m "docs: clarify global food composition sources"
```

---

## Chunk 5: Provider Adapter And Vertex

### Task 5.1: Introduce Provider Interface Around Current Developer API

**Files:**
- Create: `lib/ai/provider/types.ts`
- Create: `lib/ai/provider/developer.ts`
- Create: `lib/ai/provider/__tests__/developer.test.ts`
- Modify: `lib/ai/gemini.ts`
- Modify: route/provider creation path

- [ ] **Step 1: Resolve current `@google/genai` docs with Context7**

Use Context7 for `@google/genai` provider patterns before changing SDK usage.

- [ ] **Step 2: Confirm threshold checklist entry exists**

Provider canary rollout cannot start until the provider row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md` is filled.

- [ ] **Step 3: Write interface tests**

Mock SDK responses and assert structured output, streaming output, embeddings, retries, and usage metadata map correctly.

- [ ] **Step 4: Implement provider types**

Define `AiModelProvider`, `StructuredOutputParams`, `ProviderUsageMetadata`, and `ProviderCallMetadata`.

- [ ] **Step 5: Wrap current implementation**

Move current behavior into `developer.ts` or adapt `createGeminiClient` to delegate to provider internally without changing orchestrator behavior yet.

- [ ] **Step 6: Run existing Gemini tests**

Run: `bun run test lib/ai/__tests__/gemini.test.ts lib/ai/provider/__tests__/developer.test.ts`

- [ ] **Step 7: Commit**

```bash
git add lib/ai/provider lib/ai/gemini.ts app/api/analyze-meal/route.ts
git commit -m "refactor: wrap Gemini Developer API provider"
```

### Task 5.2: Add Generation Profiles

**Files:**
- Create/modify: `lib/ai/pipeline/model-profile.ts`
- Create: `lib/ai/provider/generation-profiles.ts`
- Tests: `lib/ai/pipeline/__tests__/model-profile.test.ts`, provider tests

- [ ] **Step 1: Write profile selection tests**

Assert per-stage/per-model generation settings are returned by profile and orchestrator no longer hardcodes values directly.

- [ ] **Step 2: Implement profile map**

Represent temperature/topP/topK/thinking config as data.

- [ ] **Step 3: Wire orchestrator**

Replace literal generation settings with profile lookups.

- [ ] **Step 4: Run tests**

Run model-profile and orchestrator tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/provider/generation-profiles.ts lib/ai/pipeline/model-profile.ts lib/ai/pipeline/__tests__/model-profile.test.ts lib/ai/pipeline/orchestrator.ts
git commit -m "refactor: use model generation profiles"
```

### Task 5.3: Define Provider Retry And SSE Idempotency Rules

**Files:**
- Modify: `lib/ai/provider/types.ts`
- Modify: `lib/ai/provider/developer.ts`
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Modify: `lib/ai/pipeline/trace.ts`
- Modify: `lib/ai/__tests__/gemini.test.ts`
- Modify: `lib/ai/pipeline/__tests__/orchestrator*.test.ts`
- Modify: `app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 1: Write retry/idempotency tests**

Cover:

- provider retry before any user-visible SSE may reuse the same compact ID seed
- no retry after user-visible `item_name` unless reset/provisional semantics exist
- buffering strategy surfaces an error instead of retrying after visible item names
- Call 2 retry replaces `item_macros` by compact `mealItemId`
- cache retry/fallback occurs only before model stream starts
- every provider attempt writes a distinct `pipeline_llm_calls` row with attempt number and error/category metadata

- [ ] **Step 2: Run failing tests**

Run: `bun run test lib/ai/__tests__/gemini.test.ts lib/ai/pipeline/__tests__/orchestrator*.test.ts app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 3: Add retry phase metadata to provider types**

Provider calls must expose enough information for the orchestrator/trace layer to distinguish pre-visible retry, post-visible retry disallowed, Call 2 replacement, and cache-fallback attempts.

- [ ] **Step 4: Wire orchestrator retry boundaries**

Apply the explicit retry rules without changing user-visible event semantics unexpectedly.

- [ ] **Step 5: Wire trace attempt rows**

Ensure failed and retried attempts each get distinct trace rows with attempt number, provider, cache status, usage metadata when available, and error category.

- [ ] **Step 6: Run tests**

Run the focused retry/idempotency suites again.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/provider/types.ts lib/ai/provider/developer.ts lib/ai/pipeline/orchestrator.ts lib/ai/pipeline/trace.ts lib/ai/__tests__/gemini.test.ts lib/ai/pipeline/__tests__ app/api/analyze-meal/__tests__/route.test.ts
git commit -m "feat: define provider retry idempotency"
```

### Task 5.4: Add Vertex Provider Implementation

**Files:**
- Create: `lib/ai/provider/vertex.ts`
- Create: `lib/ai/provider/__tests__/vertex.test.ts`
- Modify: `app/api/analyze-meal/route.ts`
- Modify: environment/config helper if present

- [ ] **Step 1: Fetch Vertex docs**

Use Context7 or Google docs for Vertex AI Gemini SDK setup, streaming, structured output, usage metadata, and auth envs.

- [ ] **Step 2: Write Vertex provider tests with mocked client**

Assert provider metadata includes `provider: 'vertex'`, region, model, input/output tokens, and error category.

- [ ] **Step 3: Implement Vertex provider behind config**

Use envs such as `AI_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`. Do not remove Developer API fallback.

- [ ] **Step 4: Wire provider factory**

Create a factory that returns Developer API or Vertex based on env, with safe fallback rules.

- [ ] **Step 5: Run provider tests**

Run: `bun run test lib/ai/provider/__tests__/vertex.test.ts lib/ai/provider/__tests__/developer.test.ts app/api/analyze-meal/__tests__/route.test.ts`

- [ ] **Step 6: Confirm threshold checklist entry exists**

Before routing any non-local traffic to Vertex, fill the Vertex provider row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/provider app/api/analyze-meal/route.ts
git commit -m "feat: add Vertex AI model provider"
```

---

## Chunk 6: Vertex Context Caching And Governance

### Task 6.1: Document Cache Governance Decision

**Files:**
- Create: `docs/ai-pipeline-vertex-cache-governance.md`
- Modify: `docs/DATABASE.md` if retention/security docs need link

- [ ] **Step 1: Write governance doc**

Document explicit static-only caches, forbidden cache contents, TTL/deletion, implicit-cache policy, and rollback behavior.

- [ ] **Step 2: Review against spec**

Ensure it states whether implicit caching is disabled where possible or accepted under Google Cloud terms.

- [ ] **Step 3: Commit**

```bash
git add docs/ai-pipeline-vertex-cache-governance.md docs/DATABASE.md
git commit -m "docs: document Vertex cache governance"
```

### Task 6.2: Add Explicit Cache Manager

**Files:**
- Create: `lib/ai/provider/cache.ts`
- Create: `lib/ai/provider/__tests__/cache.test.ts`
- Modify: `lib/ai/provider/vertex.ts`

- [ ] **Step 1: Write cache key tests**

Assert key includes provider, model, prompt static hash, schema hash, prompt label, cache format version. Assert raw input/user context/country/cooking context are not accepted.

- [ ] **Step 2: Implement pure cache key helpers**

Add hash helpers and typed cache content builder for static-only content.

- [ ] **Step 3: Add Vertex cache integration**

Use provider docs to create/use/refresh explicit cache only when enabled, model supports it, and token minimum is satisfied.

- [ ] **Step 4: Add fallback behavior**

Cache failure logs metadata and runs uncached before model stream starts.

- [ ] **Step 5: Run tests**

Run provider cache tests.

- [ ] **Step 6: Confirm threshold checklist entry exists**

Before enabling explicit caching, fill the cache row in `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/provider/cache.ts lib/ai/provider/vertex.ts lib/ai/provider/__tests__/cache.test.ts
git commit -m "feat: add static Vertex context cache manager"
```

### Task 6.3: Surface Cache Metadata In Admin

**Files:**
- Modify: `lib/ai/pipeline/trace.ts`
- Modify: `lib/admin/queries.ts`
- Modify: admin request components

- [ ] **Step 1: Add metadata tests**

Assert cached token count and cache status appear when provider returns them.

- [ ] **Step 2: Wire provider metadata to trace**

Attach cached tokens, cache status, cache key/resource label, and implicit policy label.

- [ ] **Step 3: Render admin fields**

Add concise labels near existing token display.

- [ ] **Step 4: Run tests**

Run admin and provider tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/pipeline/trace.ts lib/admin/queries.ts app/[locale]/(app)/admin/requests/[id]/_components
git commit -m "feat: show Vertex cache metadata in admin"
```

---

## Chunk 7: Shadow Comparison And Rollout Decision

### Task 7.1: Compare Canary Variants Against Thresholds

**Files:**
- Modify: `docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md`
- Modify: `lib/ai/pipeline/shadow-runner.ts` if variant labels are missing
- Modify: `lib/admin/queries.ts` if comparison data is missing
- Modify: admin request components if comparison data is missing

- [ ] **Step 1: Fill rollout threshold rows**

Before enabling any canary, fill the relevant rows for schema-format, decomposition prompt, nutrition prompt, dynamic data packet, provider, and cache variants.

- [ ] **Step 2: Add or verify shadow comparison labels**

Ensure shadow runs can distinguish current vs compressed prompts, XML vs compact dynamic data packets, Developer API vs Vertex, and cached vs uncached attempts.

- [ ] **Step 3: Run comparison on sampled/admin-approved traffic**

Use existing shadow/admin infrastructure. Do not increase shadow volume if global budget or provider pressure guards are active.

- [ ] **Step 4: Record go/no-go decision**

Update the threshold checklist with observed metrics and a go/no-go note. Do not flip defaults if thresholds are exceeded.

- [ ] **Step 5: Commit rollout notes**

```bash
git add docs/superpowers/plans/2026-05-03-ai-pipeline-prompt-budget-global-redesign-rollout-thresholds.md lib/ai/pipeline/shadow-runner.ts lib/admin/queries.ts app/[locale]/(app)/admin/requests/[id]/_components
git commit -m "docs: record AI pipeline canary rollout decision"
```

---

## Chunk 8: Final Validation

### Task 8.1: Full Test And Lint Sweep

**Files:**
- No code changes unless tests reveal issues introduced by this plan.

- [ ] **Step 1: Run focused tests from touched areas**

Run the focused suites from chunks 1-7.

- [ ] **Step 2: Run broader test suite**

Run: `bun run test`

If DB tests require env and fail for missing `DATABASE_URL`, rerun relevant DB suites with `bun --env-file=.env.local vitest run <files>`.

- [ ] **Step 3: Run Biome**

Run: `bunx @biomejs/biome@2.4.2 check .`

- [ ] **Step 4: Fix only introduced failures**

Do not fix unrelated historical failures unless they block validation of this work.

- [ ] **Step 5: Commit any validation fixes**

```bash
git add <changed-files>
git commit -m "fix: stabilize AI pipeline redesign validation"
```

---

## Execution Notes

- Keep each task's commit scoped. Do not batch unrelated chunks.
- If a migration is generated, review SQL and meaningful migration names before committing.
- Never push remote DB migrations from the agent workflow.
- Preserve existing streaming/persistence/auth/admin functionality from the April 5 work.
- Prefer additive metadata and config flags over destructive rewrites.
- Before any task that uses Vertex/Gemini SDK details, use Context7 or current Google docs.
