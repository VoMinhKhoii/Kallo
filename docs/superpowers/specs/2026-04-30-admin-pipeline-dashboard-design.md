# Admin Pipeline Dashboard — Design

Date: 2026-04-30
Branch: `feat/admin-pipeline-dashboard`
Worktree: `../kallo-admin-dashboard`
Revision: v2 (post spec-review fixes)

## 1. Problem

The AI meal-analysis pipeline is a black box in production. We log only the
outer envelope of each request (`pipeline_requests`: raw input, user
context, status, duration, error). When an analysis goes wrong, we cannot
answer:

- Which version of the decomposition / nutrition prompt was used?
- What did each pipeline stage receive and emit?
- How many LLM calls happened, with what tokens, latency, and retries?
- Did this exact input behave the same on a previous prompt version?
- Is success rate trending down? Which errors dominate?

We need a secured admin dashboard that surfaces full per-stage traces and
prompt-version history so the developer (single admin) can diagnose edge
cases, iterate on prompts, and confirm fixes.

## 2. Scope of the actual pipeline (corrected)

The pipeline (`lib/ai/pipeline/orchestrator.ts#analyzeMeal`) has **four
stages**, two of which call an LLM:

1. `decomposition` — LLM call 1 (`gemini-2.5-flash-lite`,
   `buildDecompositionPrompt(userContext)`).
2. `matching` — local ingredient matching, no LLM.
3. `nutrition` — LLM call 2 (`gemini-2.5-flash-lite`,
   `buildNutritionPrompt(...)`).
4. `assembly` — local assembly + goal adjustment, no LLM.

`lib/ai/prompts/sanitize.ts` is a string-scrubber utility used by prompt
builders; it is **not** a pipeline stage. `lib/ai/prompts/assumptions.ts`
is static UI tooltip text; **not** a pipeline stage either. The dashboard
deals only with the four stages above.

## 3. Goals / Non-goals

### Goals
- Full-trace visibility: per-stage I/O (4 stages) + per-LLM-call metadata
  (2 LLM stages).
- Automatic prompt-version tracking with in-app diff.
- Fast filtering of requests (by user, status, prompt version, date, error).
- Replay any past request through the *current* pipeline as a dry-run, with
  side-by-side comparison.
- Health overview: success rate, P50/P95 latency, error frequency.
- Zero added latency to the user pipeline (all logging fire-and-forget).
- Zero behavior change when logging fails.

### Non-goals (v2 / later)
- Multi-admin RBAC.
- Prompt editor in-app.
- Starred edge-case board, user drilldown, model A/B compare.
- Retention / nightly purge.
- Export to CSV/JSON.
- Hard-delete a request log.

## 4. Architecture

### 4.1 Auth gating

- Env var `ADMIN_EMAILS=a@x.com,b@y.com`. Empty/missing → no admins (fail
  closed).
- `middleware.ts` is updated to **bypass next-intl** for `/admin/*`:

  ```ts
  export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return updateSession(request, NextResponse.next());
    }
    const intlResponse = intlMiddleware(request);
    return updateSession(request, intlResponse);
  }
  ```

  The matcher regex already includes `/admin/*` (it only excludes `_next`,
  `api`, and static asset extensions). No matcher edit needed.

- `lib/admin/require-admin.ts#requireAdmin()` is called in **every** admin
  server component, server action, and route handler. It reads the
  Supabase session via the existing server client, splits
  `process.env.ADMIN_EMAILS` (case-insensitive, trimmed), and on failure
  calls Next's `notFound()` (404, never 403 — we don't advertise the
  surface). This is the source of truth; the middleware is a redundant
  outer layer.

### 4.2 Read path

Drizzle queries directly against the new tables. No RLS — the env gate is
the boundary, and `requireAdmin()` enforces it server-side. User-owned
tables remain RLS-protected; this design does not weaken that.

### 4.3 Write path (instrumentation)

All writes are fire-and-forget INSERTs (same pattern as
`lib/ai/pipeline/logging.ts`). A single env switch
`PIPELINE_TRACE_ENABLED` (default `true`) hard-kills all instrumentation
if needed.

## 5. Data model

All new tables added to `lib/db/schema.ts` and migrated via
`bun db:generate`. The generated migration filename is renamed
descriptively per the AGENTS.md convention.

### 5.1 `prompt_versions`

Auto-populated. One row per unique (prompt name, code hash) ever observed
in this deployment.

```
id              uuid PK default gen_random_uuid()
name            text NOT NULL  -- 'decomposition' | 'nutrition'
code_hash       text NOT NULL  -- sha256 of the prompt builder function source
                                -- (Function.prototype.toString) at module load
template_sample text NOT NULL  -- one captured rendering of the prompt with a
                                -- canned/empty UserContext, stored once at first
                                -- observation of the hash. Used for in-app diff.
model           text NOT NULL  -- e.g. 'gemini-2.5-flash-lite'
git_sha         text           -- nullable; from VERCEL_GIT_COMMIT_SHA at write time
first_seen_at   timestamptz NOT NULL default now()

UNIQUE (name, code_hash)
INDEX  (name, first_seen_at DESC)
```

**Why this approach for prompt versioning.** Prompt builders in this repo
(`buildDecompositionPrompt`, `buildNutritionPrompt`) are pure functions
that interpolate user context into the returned string — there is no
pre-existing template/render separation, and refactoring them is out of
scope for this dashboard work. We therefore version by hashing the
function source (`Function.prototype.toString()`), which:

- Cleanly captures every code change to the prompt without manual version
  bumps,
- Is computed once per process at module load (zero per-request cost),
- Contains zero user PII (function source only),
- Trade-off: also bumps the version when unrelated comments/whitespace in
  the function body change. This is acceptable; in practice prompt files
  change rarely and almost always intentionally.

The `template_sample` column stores **one** rendering of the prompt
captured at the moment a new hash is first observed, using a canned
`UserContext` (constants in `lib/admin/prompt-sample-context.ts`). This
is what the diff UI shows side-by-side. It is not user data.

### 5.2 `pipeline_stage_logs`

One row per stage per request. All four stages are logged
(decomposition / matching / nutrition / assembly). Stages 1 and 3 also
produce `pipeline_llm_calls`; stages 2 and 4 do not.

```
id            uuid PK
request_id    uuid NOT NULL FK → pipeline_requests(id) ON DELETE CASCADE
stage         text NOT NULL  -- 'decomposition' | 'matching' | 'nutrition' | 'assembly'
stage_index   int  NOT NULL  -- 1..4
input_json    jsonb
output_json   jsonb
status        text NOT NULL  -- 'success' | 'error' | 'skipped'
error         text
duration_ms   int  NOT NULL
created_at    timestamptz NOT NULL default now()

CHECK (stage IN ('decomposition','matching','nutrition','assembly'))
CHECK (status IN ('success','error','skipped'))
INDEX (request_id, stage_index)
```

### 5.3 `pipeline_llm_calls`

One row per actual LLM API call. A stage produces 1+ rows per attempt
(retries from `withRetry` add rows with incremented `attempt`). Stages
without LLM calls produce no rows here.

```
id                  uuid PK
request_id          uuid NOT NULL FK → pipeline_requests(id) ON DELETE CASCADE
stage_log_id        uuid NOT NULL  -- intentionally NOT a FK; see note below
prompt_version_id   uuid NOT NULL FK → prompt_versions(id)
model               text NOT NULL
prompt_rendered     text NOT NULL  -- final prompt as sent (vars filled in)
response_raw        text           -- nullable: null on error before response, or on stream abort
input_tokens        int            -- nullable: null when stream aborts before usageMetadata arrives
output_tokens       int            -- nullable: same
latency_ms          int  NOT NULL  -- wall-clock from call start to settlement (success or error)
attempt             int  NOT NULL default 1  -- 1 = first try, 2+ = retry from withRetry
error               text           -- nullable; the lastError message on failure
created_at          timestamptz NOT NULL default now()

INDEX (request_id)
INDEX (prompt_version_id)
INDEX (stage_log_id)
```

`stage_log_id` is intentionally **not** a foreign key. Both `logStage`
and `logLlmCall` are fire-and-forget INSERTs with no ordering guarantee
between them — declaring a FK would risk constraint violations when an
LLM-call INSERT lands before its stage-log INSERT. We accept eventual
consistency: trace integrity is best-effort (per §6), and an index on
`stage_log_id` keeps joins fast. The application reconstructs the
parent–child relation in queries; orphan llm-call rows (if a stage-log
INSERT fails entirely) simply render under an "unknown stage" group in
the UI. This matches the surrounding fire-and-forget pattern.

`request_id` is kept as a real FK because the `pipeline_requests` row is
inserted (synchronously, via the existing `logPipelineStart`) before any
stage runs, so the row is guaranteed to exist when child INSERTs fire.

`temperature` is intentionally omitted: this codebase does not pass a
temperature override; the default is sufficient and we don't need to
record it. If that changes we add the column then.

### 5.4 Extended `pipeline_requests`

Two additive columns:

```
prompt_versions_used   jsonb     -- {decomposition: <id>, nutrition: <id>}; null for failed early stages
replay_of_request_id   uuid      -- nullable self-FK ON DELETE SET NULL
                                  -- non-null = this row is a dry-run replay of the original
```

Replays are excluded from health aggregates and from the default requests
list (toggle to include).

## 6. Instrumentation

New module `lib/ai/pipeline/trace.ts` exports:

- `recordPromptVersion(name, builderFn, model): Promise<string | null>` —
  hashes `builderFn.toString()`, INSERT `... ON CONFLICT (name, code_hash)
  DO NOTHING RETURNING id` and SELECT-on-conflict, caches `(name, hash) →
  id` in a module-level `Map`. Returns the `prompt_version_id`, or `null`
  on DB failure. The caller passes a `template_sample` (one rendering of
  the builder against a canned `UserContext`) on every call; thanks to
  `ON CONFLICT DO NOTHING`, the sample is persisted only on the very
  first observation of a hash, then ignored on subsequent calls — this
  is intentional and the cache hit path can keep passing it without
  effect. When `recordPromptVersion` returns `null`, `logLlmCall` is
  skipped for that call (since `prompt_version_id` is `NOT NULL`); trace
  integrity is best-effort.
- `logStage(args): string` — fire-and-forget INSERT; returns the
  pre-generated `stageLogId` (`crypto.randomUUID()`) synchronously. The
  caller passes this id to `logLlmCall` so child rows can be joined back
  to the stage log later. There is no FK between them (see §5.3); the
  two INSERTs are independent fire-and-forget operations with no
  ordering guarantee.
- `logLlmCall(args): void` — fire-and-forget INSERT.

All gated by `PIPELINE_TRACE_ENABLED`; all swallow errors to
`console.error`.

### 6.1 requestId / traceContext plumbing (cross-cutting refactor)

This is non-trivial and called out explicitly so the implementation plan
sizes it correctly.

Today: `analyzeMeal(rawInput, userContext, db, gemini, onEvent)` does not
receive the `requestId` — it is generated in `route.ts` and used only by
`logPipelineEnd`.

Change:

- Add an optional `traceContext` to `analyzeMeal`:
  ```ts
  interface AnalyzeMealTraceContext {
    requestId: string;
    db: AppDb;
    /** Mutable holder; populated by each stage as its prompt version is resolved. */
    promptVersionsUsed: Map<string, string>;
  }
  analyzeMeal(rawInput, userContext, db, gemini, onEvent, traceContext?)
  ```
  The caller (`route.ts` for production, replay action for dashboard)
  constructs the holder, passes it in, and reads `promptVersionsUsed`
  out after `analyzeMeal` resolves to feed into `logPipelineEnd`.
- Inside `analyzeMeal`, wrap each stage in
  `withStageLog(stage, stageIndex, fn)` which:
  - generates a `stageLogId` via `crypto.randomUUID()`,
  - records `t0 = Date.now()`,
  - calls `fn({ stageLogId })` so the stage function can pass it into the
    Gemini client,
  - on resolve/reject, calls `logStage({ requestId, stageLogId, stage,
    stageIndex, input, output, status, error, durationMs })`.
- Extend `GeminiClient.generateStructuredOutputStream` (and
  `generateStructuredOutput`) signatures to accept an optional
  `trace?: { requestId, stageLogId, promptVersionId, db }`. Inside
  `withRetry`, on each loop iteration record `t0`, on success log
  `{ ..., attempt, latency_ms, input_tokens, output_tokens }`, on error
  log `{ ..., attempt, latency_ms, error: lastError.message }` then
  retry / surface as today.
- Token counts come from the SDK's `usageMetadata` at end-of-stream; if
  the stream aborts before that arrives, columns are null and `error`
  is set.
- `prompt_versions_used` is built in `analyzeMeal` from a local
  `Map<stageName, promptVersionId>` populated when each stage's
  `recordPromptVersion()` resolves. The map is returned through a side
  channel on `traceContext` (a mutable holder object) so `route.ts` can
  pass it into a new `logPipelineEnd` overload.
- `logPipelineEnd` gains an optional `promptVersionsUsed?: Record<string,
  string>` parameter; the existing call sites are unchanged.

If `traceContext` is omitted (e.g. unit tests), all `withStageLog` /
`logLlmCall` calls become no-ops. Existing tests that call `analyzeMeal`
without trace context continue to pass.

## 7. Replay (dry-run)

Replay does **not** go through the API route. The dryRun side-effect
skip is therefore localized by virtue of the route being bypassed
entirely; the orchestrator stays pure. This is the cleanest gating.

Server action `replayRequest(requestId)` in
`app/admin/requests/[id]/actions.ts`:

1. `requireAdmin()`.
2. Load original `raw_input`, `user_context_json` from `pipeline_requests`.
3. Generate a new `replayRequestId = crypto.randomUUID()`.
4. INSERT a new `pipeline_requests` row with `replay_of_request_id =
   originalId`, `status='pending'`.
5. Instantiate the same Gemini client and DB used in production. Call
   `analyzeMeal(rawInput, userContext, db, gemini, noopOnEvent,
   { requestId: replayRequestId, db })`.
6. On resolve: `logPipelineEnd(replayRequestId, 'success', durationMs, db,
   undefined, promptVersionsUsed)`.
7. On reject: `logPipelineEnd(replayRequestId, 'error', durationMs, db,
   error.message)`.
8. **No `pendingAnalyses` insert.** That insert lives in `route.ts` and is
   never reached.
9. Action returns `{ replayRequestId }`; UI navigates to
   `/admin/requests/<replayRequestId>?compare=<originalId>`.

The user pipeline (`/api/analyze-meal`) is **untouched** by replay logic
— there is no `dryRun` flag in the pipeline at all. The flag was the
wrong abstraction; bypassing the route is the right one.

A unit test (`app/admin/requests/__tests__/replay.test.ts`) asserts that
`replayRequest` does not invoke the `pendingAnalyses` writer (mocked at
the Drizzle module boundary).

## 8. Dashboard UI

Stack: existing Next.js App Router + shadcn/ui + Tailwind. Add one dep:
`diff` (npm) for prompt-version diffing.

### Routes

- `app/admin/layout.tsx` — calls `requireAdmin()`; sidebar (Requests /
  Prompts / Health) + topbar (admin email, sign out).
- `app/admin/page.tsx` — `redirect('/admin/requests')`.
- `app/admin/requests/page.tsx` — paginated table.
  - Filters (URL state): user email autocomplete, status, decomposition
    prompt vN, nutrition prompt vN, date range, min duration, error
    contains, include-replays toggle (default off).
  - Columns: created_at, user (email), status, duration_ms, decomp v,
    nutrition v, raw_input (truncated, hover for full).
- `app/admin/requests/[id]/page.tsx` — request detail.
  - Header: id, user, status, total duration, prompt versions used.
  - Vertical timeline of `pipeline_stage_logs` ordered by `stage_index`.
    Each stage card: stage name, status badge, duration, expandable
    `input_json` and `output_json` (collapsible JSON viewer with copy).
  - Nested per stage: `pipeline_llm_calls` rows, expandable to show
    rendered prompt, raw response, tokens, latency, attempt index, error.
  - Sticky action bar: **Replay (dry-run)** button.
- `app/admin/requests/[id]/page.tsx` accepts `?compare=<otherId>` to
  render side-by-side with `<otherId>`. Layout in compare mode: two
  columns of stage timelines aligned by `stage_index`; each stage shows
  a diff badge (`unchanged` / `changed` / `only-here`) computed from a
  shallow JSON-equality of `output_json`. Used by replay flow.
- `app/admin/prompts/page.tsx` — list of prompt names + version count.
- `app/admin/prompts/[name]/page.tsx` — version history; multi-select two
  versions → unified diff of their `template_sample`.
- `app/admin/prompts/[name]/[versionId]/page.tsx` — single version + paginated
  list of requests that used it.
- `app/admin/health/page.tsx` — cards driven by SQL aggregates:
  - Success rate (24h / 7d / 30d).
  - P50 / P95 / P99 `duration_ms` of successful requests (24h / 7d / 30d).
  - Requests/day sparkline (last 30d), inline SVG.
  - Top 10 error messages grouped + count for last 30d.

Data fetching: server components run Drizzle queries. Client islands only
for filter form, JSON viewer, diff viewer.

## 9. Security

- **Auth:** middleware (already covers `/admin/*` via existing matcher) +
  intl-bypass branch + `requireAdmin()` server-side. Two layers.
- **No client-side gating.** Server components throw `notFound()` before
  rendering for non-admins.
- **CSRF:** Next.js server actions are origin-checked. The only mutating
  admin action (`replayRequest`) is read-only from the user's perspective
  — it does not write to user state.
- **PII:** raw input + user_context are displayed as-is to the admin
  (single self-admin in v1). LLM API keys are never logged. Env values
  are never logged.
- **Audit:** every admin server action `console.info`s
  `[admin] <email> did <action> on <resourceId>`.

## 10. Testing

Vitest, run via `bun run test` (matches existing repo convention).

- `lib/admin/__tests__/require-admin.test.ts` — allowed/denied/no-session/
  empty env / mixed-case / whitespace.
- `lib/ai/pipeline/__tests__/trace.test.ts`:
  - `recordPromptVersion` dedups identical (name, hash); inserts on new.
  - In-process cache prevents repeated DB hits.
  - `logStage` / `logLlmCall` swallow DB errors.
  - `PIPELINE_TRACE_ENABLED=false` makes all helpers no-op.
- `lib/ai/pipeline/__tests__/orchestrator-trace.test.ts`:
  - With trace context: stage logs emitted in order with correct
    stage_index for all four stages.
  - LLM calls logged for decomposition + nutrition only; matching/
    assembly produce zero llm-call rows.
  - On retry, `attempt` increments per row.
  - Without trace context: no inserts attempted (no-op path).
- `app/admin/requests/__tests__/replay.test.ts` — `replayRequest` does
  not call `pendingAnalyses` writer (Drizzle module mocked).
- `lib/admin/__tests__/aggregates.test.ts` — health-page SQL aggregates
  return correct shapes against a seeded test DB.
- `app/admin/requests/__tests__/filters.test.tsx` — URL-state filter
  encode/decode.
- Component test for diff viewer with two synthetic prompt samples.

Lint/format with `bunx @biomejs/biome@2.4.2 check .` per repo convention.

## 11. Migration & rollout

1. Land schema additions in `lib/db/schema.ts`. Run `bun db:generate`.
   Rename the generated migration meaningfully (per AGENTS.md). Commit.
2. User runs `bun dbr:push` against staging.
3. Ship instrumentation code with `PIPELINE_TRACE_ENABLED=false` first.
   After verifying the migration is fully applied in production
   (`bun dbr:status`), flip the env to `true`. This avoids a window in
   which trace INSERTs would silently fail against tables that don't
   exist yet. Verify pipeline latency in staging is unchanged (sanity
   check via existing `[pipeline] metrics` log lines).
4. Ship admin routes; set `ADMIN_EMAILS` in production env.
5. Verify `/admin` returns 404 for non-admin sessions and renders for
   admin sessions.
6. Production deploy.

## 12. Open items deferred to v2

- Retention / nightly purge.
- Prompt editor / paste-and-replay-with-override.
- Starred edge-case triage board with notes.
- User drilldown view.
- Model A/B compare.
- Export filtered requests as JSON/CSV.
- `is_admin` column migration when multiple admins are needed.
- `temperature` column on `pipeline_llm_calls` if/when we start passing
  per-call overrides.
