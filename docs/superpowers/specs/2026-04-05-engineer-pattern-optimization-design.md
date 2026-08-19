# Engineer Pattern Optimization — Design Spec

> Implementing optimizations from `docs/claude/ENGINEER-PATTERN-OPTIMIZATION.md` across 5 independent git worktrees.

## Problem

The Kallo app has a mature AI pipeline (10-12s latency) but lacks:
- **Streaming** — user sees 10s of silence before results appear
- **Meal persistence** — analyzed meals exist only in-memory, lost on tab close
- **Error resilience** — no structured errors, inconsistent Zod validation, no shared auth utility
- **Performance polish** — no nutrition caching, no embedding warm-up, no font optimization
- **DevEx** — tests not colocated, no file length enforcement, types duplicated across Zod + TS

## Approach

5 parallel git worktrees branching from `main`, merged in priority order. Streams touch mostly independent file sets, but several hotspot files (`route.ts`, `orchestrator.ts`, `feed-area.tsx`) are touched by multiple streams — priority-order merging with rebase manages these conflicts.

**Merge order:** A → B → C → D → E (each rebases on post-merge main before its own merge).

## Architectural Prerequisites

Before any stream begins, these design decisions are locked:

### Canonical Entrypoint

The app currently has two entrypoints: `app/api/analyze-meal/route.ts` (API route) and `lib/ai/actions.ts` (server action). **The API route is canonical** for meal analysis because SSE streaming requires a route handler (server actions cannot return streams). The server action `analyzeMealAction` will be deprecated; its auth/profile logic moves into the route.

### Persistable Analysis Payload

`ParsedMeal` (the current client-facing type) drops `BoundedNutrition`, `foodCompositionId`, `matchConfidence`, and ingredient-level bounded data. It cannot be used for DB persistence.

A new `PersistableAnalysisResult` type (or the internal `PipelineResult`) must carry all data needed to populate both `meals` and `meal_items` tables. The SSE `result` event sends `ParsedMeal` to the client for display, and the `analysis_complete` event sends an `analysisId`. The route handler stores the full `PipelineResult` durably (in a `pending_analyses` DB table with TTL) so the persistence action can retrieve it when the user confirms — **not an in-memory cache**, since Vercel serverless functions may handle the SSE and confirm requests on different instances.

### Auth Derivation

All server actions derive `userId` server-side via `supabase.auth.getUser()`. No action accepts `userId` as a parameter — this is a security boundary.

## Exclusions (Deferred to Future Session)

| Item | Reason |
|------|--------|
| Weight log feature | Separate feature scope |
| Result caching (Vercel KV / Redis) | External dependency; optimize what exists first |
| Rate limiting (`@upstash/ratelimit`) | External dependency; implement after caching |
| IntersectionObserver lazy rendering | Premature — daily log won't have enough cards initially |

---

## Stream A: SSE Streaming & Perceived Performance

**Branch:** `opt/streaming-perceived-perf`
**Priority:** 🔴 Highest impact — perceived latency from 10s → 1-2s

### A0. Gemini Streaming Layer (Prerequisite)

The codebase currently has no structured output streaming from Gemini. Before any streaming work, extend `lib/ai/gemini.ts` with:
- `generateStructuredOutputStream(config)` — returns an async iterable of partial JSON chunks
- Chunk extraction utility — parses partial JSON to detect complete meal items mid-stream
- Integration with existing `GeminiClient` class

This is the foundation that A1-A3 build on.

### A1. SSE Route Handler

Rewrite `app/api/analyze-meal/route.ts` from synchronous `Response.json()` to `ReadableStream` with SSE encoding. Deprecate `lib/ai/actions.ts` `analyzeMealAction` — the route is the canonical entrypoint.

**Event types** (defined in `lib/ai/streaming/types.ts`):
- `stage` — progress update (phase name, message)
- `items_found` — meal item names extracted from decomposition
- `matching` — ingredient count being matched
- `result` — final `ParsedMeal` (display-optimized for client)
- `analysis_complete` — full `PersistableAnalysisResult` ID (for later confirm-and-save)
- `error` — error with type and message

**Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

The route stores the full `PipelineResult` in a **durable `pending_analyses` DB table** (keyed by analysis ID, with TTL — rows auto-expire after 30 minutes) so the persistence action can retrieve it when the user confirms. This avoids process-local cache failures on serverless.

**New migration:** `pending_analyses` table:
```sql
CREATE TABLE pending_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_result JSONB NOT NULL,
  raw_input TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pending_analyses_expires_idx ON pending_analyses(expires_at);
```

### A2. Stream-Aware Orchestrator

Modify `lib/ai/pipeline/orchestrator.ts` to accept `onEvent(event: StreamEvent)` callback. Emit events at each stage boundary. Uses the new Gemini streaming layer from A0.

### A3. Overlap Matching with Decomposition (moved from Stream B)

Track complete ingredients during streaming decomposition. Start DB matching as soon as each ingredient is fully extracted, not after the entire stream finishes.

- `pendingMatches: Map<string, Promise<MatchInfo | null>>` collects per-ingredient match promises
- **Key by occurrence identity** (e.g., `${mealItemIndex}:${ingredientName}`), not plain ingredient name — avoids collision when the same ingredient appears in multiple meal items
- After decomposition stream ends: `Promise.allSettled([...pendingMatches.values()])`
- Estimated saving: 1.5-2.5s

### A4. Client Stream Consumer

New `hooks/use-stream-analysis.ts` replaces `use-analyze-meal.ts`.

- Uses `fetch` + `ReadableStream.getReader()` to consume SSE
- Manages stages: `idle` → `decomposing` → `matching` → `calculating` → `done`
- Returns `{ stage, items, result, error, isAnalyzing }`

### A5. Stage-Based UI & Skeletons

New components in `components/logging/feed/skeletons/`:
- `MealCardSkeleton` — matches real MealCard dimensions exactly
- `MacroRowSkeleton` — pulsing macro bars
- `AnalysisStageSkeleton` — stage progress indicator

Modify `components/logging/feed/` to show progressive reveal:
1. Skeleton → meal item names appear
2. Skeleton macro bars → real macros fill in

### A6. Tests

- Gemini streaming layer: partial JSON parsing, complete item extraction
- SSE event encoding/decoding unit tests
- Stream consumer hook tests (mock ReadableStream)
- **Partial SSE chunks**: multiple events per chunk, split events across chunks
- **Aborted/unmounted stream consumer**: cleanup on component unmount
- **Second submit while first stream is active**: debounce or cancel
- **Non-200 streaming responses**: error event handling
- Orchestrator event emission tests
- Overlap matching: concurrent match promises resolve correctly, composite key dedup
- Component snapshot tests for skeleton states
- **Contract test**: stream delivers `analysisId` via `analysis_complete` event, and durable `pending_analyses` lookup succeeds with correct `PipelineResult`
- **Route-level SSE integration tests**: correct headers (`text/event-stream`), event ordering (decomposition → items → nutrition → result → analysis_complete), auth failure returns JSON (not SSE), in-stream error emits SSE `error` event

---

## Stream B: Pipeline Performance & Observability

**Branch:** `opt/pipeline-performance`
**Priority:** 🟡 Latency reduction + debugging foundation

### B1. In-Memory Nutrition Cache

New `lib/ai/cache/nutrition-cache.ts`:
- Module-level singleton `Map<string, NutritionPer100g>`
- Lazy-loaded on first request, persists across requests in same process
- 526 FAO items, ~500KB — safe to hold permanently (read-only at runtime)
- `getNutritionCache(db)` replaces direct DB queries in cascade matcher

### B2. Embedding Cache Warm-Up

Modify `lib/ai/matching/embedding-cache.ts`:
- New `warmEmbeddingCache(db)` loads all `ingredient_query_embeddings` rows into L1 cache
- **Not called at module init** — the DB client is lazy-loaded and `DATABASE_URL` may be absent at import time (build/test). Instead, warm on first real request: the existing `getOrComputeEmbedding` checks L1 first, and a one-time warm-up runs on the first cache miss, guarded by a module-level boolean flag.
- After warm-up: cold starts go from empty-cache → pre-warmed

### B3. Auth + Body Parse Parallelization

Modify `route.ts`:
```typescript
const [{ data: { user } }, body] = await Promise.all([
  supabase.auth.getUser(),
  request.json(),
])
```
Estimated saving: 50-100ms per request.

### B4. Prompt Input Sorting

Modify `lib/ai/prompts/`:
- Sort matched ingredients using a fixed `Intl.Collator('vi', { sensitivity: 'base' })` for deterministic ordering across Vietnamese and English inputs
- Stabilizes Gemini's prompt cache prefix for repeated similar inputs

### B5. Pipeline Observability

New migration: `pipeline_requests` table:
```sql
CREATE TABLE pipeline_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  raw_input TEXT NOT NULL,
  user_context_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

New `lib/ai/pipeline/logging.ts`:
- Fire-and-forget INSERT before pipeline starts
- Fire-and-forget UPDATE on success/failure
- Never blocks the pipeline — all logging is `.catch(console.error)`
- **Note:** `analyzeMeal()` orchestrator doesn't currently receive `userId`. Logging happens at the route handler layer (which has auth context), not inside the orchestrator. The route passes `requestId` to the orchestrator for correlation.

### B6. Tests

- Nutrition cache: load, hit, singleton behavior
- Embedding warm: verify L1 populated from DB rows, **behavior when DATABASE_URL is missing**
- Observability: logging doesn't throw, fire-and-forget behavior, **unhandled rejection safety**
- Prompt sorting: deterministic output for same inputs in different orders (Vietnamese + English)

---

## Stream C: Meal Persistence & Data Layer

**Branch:** `opt/meal-persistence-data-layer`
**Priority:** 🟡 Core feature gap — connects pipeline to persistent storage

### C1. Save Meal Server Action

New `lib/actions/meals.ts`:
- `confirmAndSaveMealAction(analysisId: string, edits?: { mealItemOrder: number, ingredientIndex: number, newGrams: number }[])` — **derives userId server-side** via `supabase.auth.getUser()`, never accepts userId as parameter
- Retrieves the full `PipelineResult` atomically: `DELETE FROM pending_analyses WHERE id = $1 AND user_id = $2 AND expires_at > now() RETURNING pipeline_result` — this consumes the row (preventing duplicate confirms) and rejects expired analyses in one query
- If `edits` provided, applies quantity overrides to the stored PipelineResult before persisting — edits are keyed by `{ mealItemOrder, ingredientIndex }` (stable positional identity from the pipeline result array structure), not ingredient name (which may not be unique across dishes)
- Persists `BoundedNutrition` (low/mid/high JSONB) for all 28 nutrient columns
- Persists per-item data: `ingredientName`, `estimatedGrams`, `foodCompositionId`, `matchConfidence`, item-level bounded nutrition
- **Meal-item grouping**: adds `meal_item_name` (TEXT) and `meal_item_order` (INTEGER) columns to `meal_items` via schema migration — each ingredient row is tagged with its parent dish name and display order so loads can reconstruct the grouped structure
- Uses **pipeline's `mealSlot`** if present; falls back to time-of-day heuristic only if null
- `loggedAt` stored as `timestamptz`; date grouping uses client-provided timezone offset
- **Single DB transaction** wraps the entire operation: consume `pending_analyses` row + insert `meals` + insert `meal_items`. If any step fails, everything rolls back (the pending row is restored, the user can retry confirm).
- Returns created meal ID
- Zod-validated input (analysisId is a UUID string, edits array is optional)

### C2. Load Meals Server Action

`loadMealsByDate(date: string, timezoneOffset: number)` — **derives userId server-side**.
Groups meals by date in the user's timezone (not UTC).
Returns `BoundedNutrition` — client computes display values via goal adjustment.

### C3. Delete Meal Server Action

`deleteMealAction(mealId: string)` — **derives userId server-side**. DELETE with user_id check (defense in depth beyond RLS).

### C4. Enhanced FeedArea

Modify `components/logging/feed/feed-area.tsx`:
- On mount: `useQuery(['daily-meals', selectedDate])` loads meals from DB — **userId is NOT in the query key** (server action derives it); cache is per-session anyway
- New analyses append to feed and persist on "Confirm & Log Meal" click
- Deleted meals removed from UI optimistically

### C5. Client-Side Goal Adjustment

New `hooks/use-displayed-macros.ts`:
- `useDisplayedMacros(bounded, profile)` → derives display values from BoundedNutrition + user goal/aggression
- `useMemo` with deps on `[bounded, profile.goal, profile.aggression]`
- When user changes goal in settings, all meal cards update instantly — no re-fetch

### C6. Optimistic Updates

TanStack Query's `onMutate`/`onError`/`onSettled` pattern:
- **Save:** optimistically add meal to query cache → rollback on error
- **Delete:** optimistically remove from cache → rollback on error
- Toast on rollback: Vietnamese error messages

### C7. SWR for Historical Data

Query configuration:
- Today: `staleTime: 0` (always refetch)
- Past dates: `staleTime: Infinity, gcTime: Infinity`
- Date navigation becomes instant after first load

### C8. Prefetch Adjacent Dates

New `hooks/use-prefetch-dates.ts`:
- When viewing today, prefetch yesterday in background
- When viewing any date, prefetch day before and day after

### C9. Wire TimelineSidebar to Real Data

Modify `components/logging/sidebar/timeline-sidebar.tsx`:
- Replace hardcoded mock data with real dates from DB
- Query: distinct dates that have meals → group into weeks/months
- Dates shown only up to current client time (no future dates)
- New date appears automatically at midnight (timeout set to time-remaining-to-midnight)
- New day auto-selected when it appears
- `selectedDate` state managed in a **new client wrapper component** (`LoggingShell`) that receives server-fetched targets **and profile subset** (`goal`, `aggression`) from the server component page — the page itself is a server component and cannot hold client state. Profile data is needed for `useDisplayedMacros` to recompute displayed values client-side.

### C10. Derived Daily Totals

Modify `components/logging/feed/macro-summary.tsx`:
- `useMemo` to derive totals from meal list — never stored as separate state
- MacroSummary reads from derived state, not separate query

### C11. Tests

- Save/load/delete server action tests (mock DB)
- **Transaction rollback**: meals insert succeeds, meal_items fails → meals row rolled back
- **Timezone boundary**: meals logged near midnight appear on correct date
- **Edited meal save**: user adjusts quantities → confirm payload carries edits → server recomputes nutrition → persistence reflects edits
- Optimistic update rollback behavior
- `useDisplayedMacros` hook tests (goal adjustment math)
- SWR configuration (stale times for today vs past)
- TimelineSidebar: date generation, midnight rollover
- Round-trip: save → load → verify data integrity, **including meal-item grouping reconstruction** (ingredients correctly regrouped under parent dish names via `meal_item_name`/`meal_item_order`)
- **Attach mealId to unmatched ingredients** after persistence
- **Persistence mapping**: pipeline result → `meals`/`meal_items` rows → verify `BoundedNutrition`, `mealSlot`, `matchConfidence`, `foodCompositionId` all survive round-trip
- **LoggingShell integration**: date selection in TimelineSidebar drives FeedArea data; optimistic save/delete across day switch

---

## Stream D: Hardening & Error Resilience

**Branch:** `opt/hardening-error-resilience`
**Priority:** 🟢 Foundational utilities + robustness

### D1. Structured Error Types

New `lib/errors.ts`:
- `AppError` class: `code`, `status`, `retryable`, `userMessage` (Vietnamese)
- `Errors` factory: `notAuthenticated()`, `onboardingIncomplete()`, `pipelineTimeout()`, `validationFailed()`, etc.
- Route error handler: **pre-stream failures** (auth, validation, onboarding) return `AppError` → structured JSON with appropriate HTTP status; **in-stream failures** (after SSE headers sent) emit an SSE `error` event with the same `AppError` payload — the route cannot switch to JSON once streaming has begun

### D2. `requireAuthAndProfile()` Utility

New `lib/auth.ts`:
- Combines `supabase.auth.getUser()` + profile fetch
- Throws `Errors.notAuthenticated()` or `Errors.onboardingIncomplete()`
- Replaces inline auth checks in all route handlers

### D3. Zod Boundary Audit

- `messageSchema`: add `.trim()`, `.transform(s => s.normalize('NFC'))`, `.refine(s => /\p{L}/u.test(s))`
- Server Action arguments: wrapped in Zod schemas
- URL search params: validated before use
- All external inputs: validated at entry point

### D4. Request Deduplication

- `useRef(false)` guard in submit handler to prevent double-submit
- Submit button: **keep `disabled` attribute** for accessibility (screen readers, keyboard navigation) **plus** JS guard via ref — do not replace `disabled` with CSS-only `pointer-events-none`
- Style the disabled state to avoid layout shift: `disabled:opacity-50 disabled:cursor-not-allowed`

### D5. Timeout Wrapper

New `lib/fetch-with-timeout.ts`:
- `fetchWithTimeout<T>(fn, timeoutMs, label)` — generic timeout/rejection wrapper for any async operation
- **Note:** this rejects the caller's promise after timeout, but cannot cancel in-flight DB queries (no `AbortSignal` support in postgres.js). The underlying operation may still complete in the background. This is timeout-as-rejection, not true cancellation.
- Applied to DB queries and external calls outside pipeline
- Pipeline keeps its own `withTimeout`

### D6. Retry Utility

New `lib/retry.ts`:
- `withRetry<T>(fn, maxAttempts, baseDelayMs)` — exponential backoff + jitter
- `isNotRetriable()` filter for auth/validation/not-found errors
- **Restricted to reads and idempotent operations only** — writes (meal insert, logging insert) must not be retried unless they have a natural idempotency key (e.g., `ON CONFLICT DO NOTHING`)

### D7. Three-State Validation Model

Modify `lib/ai/pipeline/validation.ts`:
- `classifyAnomalies(anomalies)` → `'proceed' | 'flag_and_proceed' | 'retry_step2' | 'reject'`
- Replaces ad-hoc zero-calorie retry logic with principled decision table

### D8. Error Boundaries for Async Operations

- All `useQuery` calls: explicit `isLoading`/`error`/`data` handling
- New `InlineError` component for partial failures
- Inline retry buttons — never full-page crash for partial failures

### D9. Tests

- AppError construction and serialization
- `requireAuthAndProfile` with mock Supabase (auth, no auth, incomplete profile)
- Zod boundary validation: valid + invalid for each schema
- Timeout wrapper: fast fn, slow fn, abort behavior
- Retry: backoff timing, non-retriable bypass, **retries not applied to write operations**
- `classifyAnomalies` decision table coverage
- Double-submit prevention

---

## Stream E: DevEx & Polish

**Branch:** `opt/devex-polish`
**Priority:** 🟢 Code quality + developer experience

### E1. Uncontrolled Input with localStorage Persistence

Modify `components/logging/input/meal-input.tsx`:
- `useRef<HTMLTextAreaElement>` instead of `useState` for input value
- Debounced save to `localStorage` (500ms inactivity via `input` event listener)
- Save on `beforeunload` event (tab close)
- On mount: `defaultValue` from `localStorage` key `nham:meal-input-draft`
- On successful submit: clear localStorage entry
- Parent (FeedArea) no longer re-renders on every keystroke

### E2. CSS Transitions Over JS Animations

Audit `components/` for animation usage:
- Simple one-property transitions → CSS `transition` property
- Complex sequences → keep Motion library
- Rule: one property = CSS, sequences/dependencies = Motion

### E3. Font Loading Optimization

Modify `app/layout.tsx`:
- All fonts: `display: 'swap'`, `preload: true`
- Fraunces (display font): `display: 'optional'` — no flash if not loaded by paint
- Audit: only load weights actually used, trim unused weights

### E4. 400-Line Rule Enforcement

New `scripts/check-file-length.ts`:
- Scan all `.ts`/`.tsx` files, flag any > 400 LOC
- Exceptions: `schema.ts`, `*.generated.*`, `node_modules/`
- Add to `package.json` scripts: `"lint:length": "bun run scripts/check-file-length.ts"`
- Can be added to CI pipeline

### E5. Colocated Tests

Move unit tests from `__tests__/` to sit alongside source:
- `lib/ai/pipeline/__tests__/goal-adjustment.test.ts` → `lib/ai/pipeline/goal-adjustment.test.ts`
- Integration tests stay in `__tests__/` directories
- **Update `vitest.config.ts` include pattern**: current pattern is `['**/__tests__/**/*.test.{ts,tsx}']` — must be expanded to `['**/*.test.{ts,tsx}']` to pick up colocated tests
- Verify all tests still pass after move

### E6. Decision Log in AGENTS.md

Add `## Decision Log` section to `AGENTS.md`:
- Template: Context → Decision → Tradeoff → Status
- Seed with existing decisions: vector search primary, no clarifying questions, BoundedNutrition storage format, etc.

### E7. E2E Type Safety Audit

- Identify hand-written TypeScript types that mirror Zod schemas → replace with `z.infer<typeof schema>`
- Identify hand-written types that mirror Drizzle table types → replace with `$inferSelect`/`$inferInsert`
- Goal: single source of truth for every type

### E8. Tests

- 400-line check script: test the script itself
- Input persistence: localStorage save/restore/clear behavior
- Colocated tests: verify all pass after file moves
- Type safety: TypeScript compiler is the test

---

## Cross-Stream Dependencies

```
Stream A (streaming) ─── merges first (clean to main)
     │
Stream B (perf) ──────── rebases on post-A main
     │
Stream C (persistence) ── rebases on post-A+B main
     │                    (C depends on A's streaming types)
Stream D (hardening) ──── rebases on post-A+B+C main
     │
Stream E (polish) ─────── merges last
```

**Merge-sensitive files (conflict hotspots):**
- `route.ts` — A rewrites to SSE, B adds auth parallelization, D adds auth utility usage
- `orchestrator.ts` — A adds streaming events + overlap matching, B adds caching hooks
- `feed-area.tsx` — A adds stream consumer, C adds persistence/optimistic updates, D adds submit deduplication (D4) + error boundaries (D8), E touches input handling
- `meal-input.tsx` — E switches to refs, A/C may have side effects
- `app/(app)/logging/page.tsx` — C adds LoggingShell wrapper, D may add auth changes

**Mitigation:** Priority-order merging with rebase. Each stream's implementer must run full test suite after rebase, before merge. Semantic conflicts (not just textual) require manual review at each merge point.

## Success Criteria

1. **Stream A:** User sees meal item names within 2s of submission (not 10s)
2. **Stream B:** Repeat requests show 0 DB queries for nutrition data; pipeline_requests table populated
3. **Stream C:** Meals persist across page refreshes; date navigation loads historical meals instantly
4. **Stream D:** All external inputs Zod-validated; structured errors with Vietnamese messages
5. **Stream E:** No files > 400 LOC (except schema); tests colocated; input survives tab close
