# AI Pipeline Prompt Budget, Global Usage, and Vertex Reliability Redesign

**Date**: 2026-05-03  
**Status**: Approved by spec review, pending user review  
**Predecessors**:

- `docs/superpowers/specs/2026-03-31-pipeline-v2-design.md`
- `docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md`
- `docs/superpowers/specs/2026-04-30-admin-pipeline-dashboard-design.md`

## 1. Context

The current AI nutrition pipeline has become more capable than the original
Vietnam-focused design. It now has FAO and USDA source-aware matching,
pipeline-run telemetry, admin prompt tracing, shadow-run infrastructure, and a
type-narrow prompt personalization boundary. Those are good traits and must be
preserved.

The next bottleneck is prompt and provider efficiency. The runtime still asks a
Flash Lite model to follow a long decomposition prompt with many
Vietnamese-specific examples and UUID-shaped run IDs. That extra text pulls the
model toward Vietnamese output even for English meal input, slows model calls,
and makes the app feel less global than the data model has become.

Current local measurements on this branch, using the existing prompt builders:

| Surface | Approximate size |
| --- | ---: |
| Decomposition prompt | 10,707 chars, about 2,677 tokens |
| Small nutrition prompt | 4,967 chars, about 1,242 tokens |
| Decomposition JSON schema | 2,736 chars, about 684 tokens |
| Nutrition JSON schema | 3,013 chars, about 753 tokens |

The admin request detail already records and displays provider-reported
`input_tokens` and `output_tokens` when Gemini streaming usage metadata is
available. The missing observability is not a new dashboard; it is richer prompt
budget, schema, provider, cache, and language metadata inside the existing admin
request surface.

Two production-readiness gaps also surfaced during the design review:

- There is no app-owned abuse limiter before `POST /api/analyze-meal` spends
  model tokens. Current code only handles upstream Gemini 429s after the
  pipeline is already running.
- `buildUserContext()` does not pass profile locale into the AI pipeline, and
  Call 1 relies on prompt examples to infer display language. This explains the
  reported bug where English input produced Vietnamese output.

This spec defines a single comprehensive redesign with independently shippable
phases. It does not ask implementation to land every change in one commit.

## 2. Goals

1. Preserve the current pipeline spine: decomposition -> DB matching -> bounded
   nutrition -> deterministic goal adjustment.
2. Reduce model prompt burden without deleting reliability features.
3. Make output language explicit and primarily based on the user's meal input.
4. Protect outsider-facing internal usage with rate limits and cost guards.
5. Move production Gemini access to Vertex AI with rollback and cache support.
6. Treat FAO and USDA as food-composition sources in a global product, not as
   Vietnam-only routing concepts.
7. Use admin traces, telemetry, validators, and shadow runs to preserve quality
   instead of relying on a giant system prompt.

## 3. Non-Goals

- Do not add a new food database in this spec.
- Do not rename `vietnamese_food_composition` in this spec. The physical table
  name can remain until a separate migration justifies the risk.
- Do not remove Vietnamese-specific search protections. Diacritic-aware routing
  and Vietnamese aliases remain where they solve real matching problems.
- Do not introduce behavioral personalization. Goal, aggression, recent meals,
  and user history stay out of LLM prompts.
- Do not use prompt compression as permission to accept silent nutrition
  regressions.

## 4. Governing Principles

### 4.1 Preserve The Spine

The reliable shape remains:

```text
User meal text
  -> Call 1: decomposition
  -> source-aware food matching
  -> Call 2: bounded macro estimation
  -> deterministic goal adjustment
  -> persisted meal and admin telemetry
```

The redesign removes prompt ceremony around this spine. It does not replace the
spine with a single opaque model call.

### 4.2 Runtime Owns Mechanics

The model should not invent UUIDs, route data sources, enforce quotas, manage
caches, or decide rollout policy. Runtime code owns those mechanics.

### 4.3 The LLM Produces Meal Facts

The LLM estimates physical meal facts. Deterministic code applies user goals.
Language selection is a presentation contract, not a nutrition preference.

### 4.4 Input Language Drives Display Language

User-facing meal and ingredient names should match the language of the user's
meal input by default. Locale is a fallback for ambiguous or mixed input, not a
reason to translate clear English input into Vietnamese or vice versa.

### 4.5 Spend Tokens Only After Cheap Gates

Auth, validation, rate limits, concurrency limits, and obvious spam checks run
before provider calls. Shadow work and admin replay are the first things to
disable under quota pressure.

## 5. Target Architecture

### 5.1 Request Guard Layer

Before a request reaches Gemini or Vertex:

1. Authenticate the user.
2. Validate the request body with Zod.
3. Run cheap spam and shape checks.
4. Detect input language.
5. Determine output language from input language, active/request locale, profile
   locale, then default locale.
6. Check per-user rate limits, concurrent in-flight limits, admin replay limits,
   and global cost circuit breakers.

Blocked requests return JSON 429 before SSE starts. They must not create a full
`pipeline_requests` row because there is no pipeline run to inspect. They do
need operational visibility, so implementation should add a lightweight guard
event path, for example `analysis_guard_events`, containing hashed user/IP keys,
reason, retry-after, route, and timestamp. It must not store raw meal text or
user context.

### 5.2 Compact Runtime-Owned IDs

Replace UUID-shaped model IDs with compact run-scoped IDs owned by runtime.

Current behavior asks Call 1 to emit UUID-shaped `mealItemId` and
`ingredientId`, then runtime replaces invalid or duplicate IDs. That is both
token-expensive and unnecessary. These IDs only need to distinguish repeated
items inside one analysis run.

New behavior:

- Call 1 no longer emits IDs.
- The decomposition stream assigns compact meal IDs (`m1`, `m2`, ...) as item
  names appear and threads them into the parsed decomposition.
- After Call 1 parse, runtime assigns ingredient IDs (`i1`, `i2`, ...) in stable
  traversal order.
- Call 2 receives these IDs and echoes them.
- Assembly, validation, matching, nutrition reconciliation, and SSE continue to
  key by ID, preserving duplicate-name safety.
- During migration, runtime may accept old UUID IDs, but normal output should
  use compact IDs.

This reduces prompt size and removes a fragile model obligation while
preserving the reason IDs were introduced.

### 5.3 Language Contract

Add explicit language handling to the pipeline.

#### Language Detection

Create `detectMealInputLanguage(rawInput)` with conservative heuristics for the
currently supported display locales:

| Signal | Output |
| --- | --- |
| Vietnamese diacritics or strong Vietnamese food words | `vi` |
| Clear English/ASCII input | `en` |
| Mixed or uncertain input | fallback to request/profile locale, then `en` |

The request schema should accept an optional validated `locale` field, or the
server should pass profile `preferredLocale` into the pipeline as fallback. The
meal input language remains the primary signal.

#### Prompt Contract

Call 1 gets a short instruction:

```text
Output user-facing meal item names and raw ingredient names in <outputLanguage>.
Keep canonicalName matching-oriented; it may use food-composition vocabulary.
Do not translate clear user input into another display language.
```

Call 2 must echo IDs and names from decomposition exactly. If Call 1 chooses the
right display language, Call 2 should not translate user-facing names.

#### Runtime Guard

After Call 1 parse, run a lightweight language guard over meal item names and
raw ingredient names:

- If `outputLanguage=en` and display fields are clearly Vietnamese, retry Call 1
  once with a short corrective message.
- If `outputLanguage=vi` and display fields are clearly English despite clear
  Vietnamese input, retry once.
- If the retry still mismatches, continue and log `language_mismatch` rather
  than blocking the meal.

Admin traces should show detected input language, chosen output language,
fallback reason, mismatch result, and retry count.

#### Streaming Semantics

Language correction happens after enough of Call 1 has been parsed, while the
UI may already have received early item-name events. To preserve streaming
without showing contradictory final names, decomposition stream events become
provisional until the language guard commits them.

Required event semantics:

- `item_name` events emitted before the guard passes are provisional.
- If no retry is needed, the server emits a commit marker or final result that
  confirms those IDs/names.
- If a language retry is needed, the server emits a reset/correction event for
  the affected analysis attempt, then re-emits corrected `item_name` events with
  stable compact IDs.
- Admin traces link the original Call 1 attempt and the corrective retry.

If implementation chooses not to add provisional/reset events in the first
slice, it must buffer item-name events until the language guard passes. That is
slower but simpler. The implementation plan must choose one of these two
semantics explicitly before coding.

### 5.4 Prompt Compression

#### Decomposition Prompt

Convert the current decomposition prompt from a cuisine tutorial into a compact
global extraction contract. It should cover:

- food vs non-food classification
- meal item boundaries
- cooked/as-eaten grams
- raw display name vs matching-oriented canonical name
- cooking method and expected state
- ambiguity flags
- explicit/fundamental ingredients only
- output language
- no source-routing fields

Remove most runtime examples. Keep at most one short multilingual example if
shadow/admin traces prove it is needed. Store richer examples in tests and eval
fixtures, not in the prompt sent on every request.

#### Nutrition Prompt

Keep Call 2 as bounded macro estimation, but reduce instruction text. The prompt
receives structured facts:

- compact meal and ingredient IDs
- user-facing names from decomposition
- as-eaten grams
- cooking method and expected state
- matched DB row name, source, state, and 4 macro values
- unmatched ingredients grouped under parent meal items
- output-language and exact-name echo rule

Call 2 should return only the required bounded macros and IDs. Deterministic
validators carry most guardrail responsibility.

#### Dynamic Data Format

The existing XML format is readable and may help model parsing, but it is
verbose. Implementation should compare the current XML against a compact JSON or
columnar packet behind a prompt label. Adopt the smaller representation only if
admin/shadow traces show it preserves quality.

### 5.5 Schema Slimming

Runtime Zod schemas can keep developer descriptions. Provider JSON schemas do
not need every description. Add a helper that generates Gemini/Vertex response
schemas with nonessential `description` fields stripped while preserving:

- object structure
- required fields
- enum values
- numeric/string constraints that the provider supports
- runtime Zod parse after response

This targets the current hidden schema overhead of roughly 684 to 753 tokens per
LLM call.

### 5.6 Provider Adapter And Vertex Migration

Introduce a provider interface that preserves the current `GeminiClient` shape
but returns richer metadata.

The production target is Vertex AI. The current Developer API remains a dev and
rollback provider.

Provider calls should return or log:

- provider: `developer_api` or `vertex`
- model
- region/location
- input tokens
- output tokens
- cached content tokens, where available
- thoughts tokens, where available
- latency
- cache status and cache resource/hash
- raw provider error category

Provider config should be environment-driven:

- Vertex project
- Vertex location
- model profile
- provider selection
- fallback provider
- cache enablement
- cache TTL
- generation profile label

### 5.7 Model Generation Profiles

Move temperature, topP, topK, and thinking config out of orchestrator call sites
and into per-model generation profiles.

This matters because Gemini 2.5 Flash Lite, Gemini 3.1 Flash Lite, and
escalation models may have different recommended settings. Vertex docs also
recommend low thinking for latency-sensitive Gemini 3 usage and caution that
temperature behavior can differ by model family.

Profiles should be testable data, for example:

```text
decomposition: gemini-2.5-flash-lite -> low temperature, no explicit thinking
decomposition: gemini-3.1-flash-lite -> provider-recommended temperature,
  low/minimal thinking for latency
nutrition: gemini-2.5-flash-lite -> bounded-estimate profile
nutrition: escalation -> quality profile
```

Exact values belong in implementation and canary review, not in this spec.

### 5.8 Vertex Context Caching

Vertex context caching is part of the target production design, but it must be
safe and measured.

Cache only static/shared content:

- static prompt contract
- slim response schema if supported by the request shape
- versioned static examples, if any remain

Never cache:

- raw user input
- user ID or profile ID
- country/cooking context
- generated meal data
- admin replay payloads

Cache keys include:

- provider
- model
- prompt static hash
- slim schema hash
- prompt label
- cache format version

Cache failures are non-fatal. The provider retries uncached on Vertex and logs
cache status. Cache TTL, deletion, and data-retention behavior must be
documented.

Important provider constraint: explicit cache minimums differ by model family.
The implementation must check model support and token minimums before creating a
cache. If the compressed static prompt falls below the minimum, skip explicit
caching and rely on prompt compression plus any implicit caching that remains
allowed by the chosen data-governance policy.

#### Implicit Cache Governance

Vertex may also apply implicit caching to repeated prompt prefixes. That can be
useful for cost and latency, but it is a data-governance decision because normal
requests include dynamic meal text and user context outside explicit caches.

Implementation must choose and document one of these policies:

1. Disable implicit caching for dynamic meal-analysis requests where provider
   controls allow it, while using explicit caches only for static content.
2. Accept implicit caching under the project's Google Cloud data-processing
   terms, document the retention/control behavior, and ensure no extra sensitive
   fields beyond the already-required meal request are added to model prompts.

The default recommendation is policy 1 when technically supported. If policy 2
is required by provider limitations, admin documentation must say so clearly.

### 5.8.1 Provider Retry And Streaming Idempotency

Provider retries must be explicit because SSE can expose partial model output.

- Retries before any user-visible SSE event may reuse the same compact ID seed.
- Retries after provisional item-name events must either use the reset/correction
  semantics from Section 5.3 or be disallowed in favor of surfacing an error.
- Call 2 retries may re-emit `item_macros`; the client must replace by compact
  `mealItemId`, as it does today by stable IDs.
- Cache lookup/create failures may retry uncached only before model streaming
  starts.
- Every provider attempt must produce a distinct `pipeline_llm_calls` row with
  attempt number, provider, cache status, usage metadata when available, and
  error category when failed.

### 5.9 Rate Limiting And Cost Circuit Breakers

Add app-owned throttling before model work.

Required policies:

- per-user analysis quota per minute/hour/day
- per-user concurrent in-flight analysis limit
- admin live replay quota
- shadow-run quota and auto-disable under pressure
- global daily request/token budget
- provider 429/error spike guard

Use a database-backed limiter for production correctness across Cloud Run
instances unless a shared low-latency store is introduced. In-memory guards are
acceptable only as local secondary protection.

In-flight counters must release in `finally` and on stream abort. This is
required for correctness when users close the page or quickly retry.

Rate-limit telemetry should be aggregate and operational. It must not feed back
into per-user prompt personalization.

### 5.10 Admin Observability

Extend the existing admin request detail, not a parallel dashboard.

The LLM call rows already show model, latency, input tokens, output tokens,
prompt, and response. Add:

- static prompt chars and approximate tokens
- dynamic user/data chars and approximate tokens
- JSON schema chars and approximate tokens
- provider-reported input/output/cached/thought tokens
- provider, region, model profile, generation profile
- cache status and cache key/resource label
- prompt label/canary label
- input language, output language, and mismatch retry count
- rate-limit/cost-guard counters at request or rollup level

This is the primary review surface for deciding whether the new equilibrium is
better.

### 5.11 Global Food-Source Vocabulary

The product should describe food composition globally. Existing FAO Vietnam data
is a source, not the whole product identity.

Update docs and new comments to prefer:

- food composition data
- food sources
- source-aware matching
- FAO Vietnam source
- USDA source
- source-neutral matching

Keep Vietnamese-specific language only where it describes a Vietnamese-specific
mechanism, such as diacritic routing or FAO Vietnam extraction.

No destructive table rename is part of this spec.

## 6. Rollout Phases

### Phase 0: Abuse Protection And Baseline

- Add rate limiting and in-flight concurrency guards before model calls.
- Add global cost circuit breaker and shadow/admin replay quota controls.
- Extend admin traces with prompt-budget, provider, language, and cache fields.
- Add lightweight guard-event telemetry for blocked requests with no raw meal
  text.
- Capture baseline metrics from current prompts and provider.

### Phase 1: Language Contract And Compact IDs

- Replace UUID-shaped Call 1 IDs with runtime-owned compact IDs.
- Add input-language detection and output-language selection.
- Add optional request locale or profile locale fallback.
- Add post-decomposition language guard and one retry.
- Choose either provisional/reset streaming semantics or buffered item-name
  semantics before implementation.
- Keep the current Developer API provider to isolate prompt changes.

### Phase 2: Schema Slimming

- Add provider-schema generation helper that strips nonessential descriptions.
- Release behind a schema-format label.
- Compare parse errors and schema-validation failures before making it default.

### Phase 3: Prompt Compression

- Compress decomposition prompt by label/canary.
- Compress nutrition prompt by label/canary.
- Compare current XML dynamic data against compact JSON/columnar data before
  changing the default data packet.

### Phase 4: Global Cleanup

- Update source-neutral docs/comments/helpers.
- Preserve Vietnamese-specific search protections.

### Phase 5: Vertex Provider Adapter

- Add provider abstraction.
- Add Vertex implementation without explicit context caching first.
- Validate auth, region, streaming, usage metadata, retries, and rollback.
- Keep Developer API fallback available by config.

### Phase 6: Vertex Context Caching

- Add static-only explicit cache manager.
- Gate cache creation by model support and token minimums.
- Decide and document implicit-cache policy.
- Record cached token counts and cache status in admin.
- Document TTL and deletion behavior.

### Phase 7: Shadow Comparison And Rollout

- Compare prompt labels, providers, and cached/uncached variants.
- Review latency, token usage, cached tokens, retry rate, anomaly rate,
  unmatched rate, source distribution, language mismatch rate, and macro
  divergence.
- Before enabling each canary, define rollout thresholds for the metrics being
  compared. The design intentionally does not hardcode universal thresholds, but
  the implementation plan must name them before rollout.
- Roll forward by config when evidence is good.

### Phase 8: Follow-Up Opportunities

Only after the above are measured:

- deeper deterministic nutrition for matched rows
- future food-source plugin architecture
- additional food databases
- stricter abuse analytics
- broader language support beyond `en` and `vi`

## 7. Data And Schema Changes

Expected additive changes, subject to implementation planning:

- Extend `pipeline_llm_calls` or an adjacent metadata table with provider,
  region, prompt budget, schema budget, cached tokens, thoughts tokens, cache
  status, language fields, and generation profile.
- Add or extend rate-limit storage for per-user and global counters. Persist
  hashed keys only where possible.
- Add aggregate rate-limit/cost-guard counters to admin/KPI queries.
- Consider adding `preferredLocale` or `outputLanguage` to the in-memory AI
  request context. This does not require storing new user preference data; the
  profile already has `preferred_locale`.

Drizzle remains the source of truth for application table shape. Raw SQL owns
RLS, policies, functions, triggers, and extension-specific logic. Remote DB
pushes remain user-owned.

## 8. Affected Code Areas

Likely implementation touchpoints:

- `app/api/analyze-meal/route.ts`
- `lib/validation.ts`
- `lib/ai/gemini.ts`
- `lib/ai/pipeline/orchestrator.ts`
- `lib/ai/pipeline/ids.ts`
- `lib/ai/pipeline/decomposition-stream.ts`
- `lib/ai/pipeline/schemas.ts`
- `lib/ai/prompts/decomposition.ts`
- `lib/ai/prompts/nutrition.ts`
- `lib/ai/prompts/types.ts`
- `lib/ai/mappers.ts`
- `lib/ai/pipeline/run-telemetry.ts`
- `lib/ai/pipeline/shadow-runner.ts`
- `lib/ai/pipeline/shadow-guards.ts`
- `lib/db/schema.ts`
- `lib/admin/queries.ts`
- `app/[locale]/(app)/admin/requests/[id]/_components/*`
- `docs/DATA.md`
- `docs/DATABASE.md`
- `INGREDIENT_MATCHING_ARCHITECTURE.md`

New modules should be small and purpose-bound. Avoid growing
`orchestrator.ts` with provider, rate-limit, or language-policy details.

## 9. Testing Strategy

### 9.1 Prompt Contract Tests

Tests must assert that compressed prompts still cover:

- food/non-food classification
- grams as cooked/as-eaten mass
- raw display names and matching-oriented canonical names
- state hints
- ambiguity flags
- output language
- no source-routing fields
- no goal/aggression/calorie target leakage

### 9.2 Prompt Budget Tests

Add snapshot-style budget tests for:

- static prompt size
- dynamic prompt/data size
- schema size
- total approximate tokens

Use reviewed baselines and intentional update flow, not arbitrary universal
thresholds.

### 9.3 Compact ID Tests

- IDs are assigned by runtime as `m1`, `m2`, `i1`, `i2`, ...
- Duplicate meal names and duplicate ingredient names remain distinct.
- Streaming item IDs match final parsed item IDs.
- Call 2 ID echo and reconciliation work with compact IDs.
- Legacy UUID IDs are tolerated only during migration if needed.

### 9.4 Language Tests

- English input produces English display names.
- Vietnamese input produces Vietnamese display names.
- Mixed input uses deterministic fallback.
- Unaccented Vietnamese input such as `pho bo` does not automatically force the
  wrong display language without fallback review.
- Code-switched input preserves the dominant or user-typed display language.
- English input containing Vietnamese dish names, such as `pho bo with beef`,
  does not translate unrelated English words into Vietnamese.
- Brand and restaurant names are preserved rather than translated.
- Unsupported non-English/non-Vietnamese input falls back predictably and logs
  the fallback reason.
- Profile/request locale is used only when input language is uncertain.
- Language mismatch triggers one retry and telemetry.
- Goal/aggression remain absent from prompts.

### 9.5 Rate Limit Tests

- Allowed request proceeds to pipeline.
- Quota-exceeded request returns 429 before SSE/model work.
- Retry-after is set.
- No model call is made for blocked requests.
- In-flight counter releases on success, error, and abort.
- Admin live replay and shadow runs have separate quota behavior.

### 9.6 Provider And Cache Tests

- Developer API and Vertex implementations satisfy the same interface.
- Usage metadata maps input/output/cached/thought tokens correctly.
- Cache key excludes raw input and per-user context.
- Cache failure falls back uncached.
- Implicit-cache provider settings match the documented governance policy.
- Provider retries obey streaming/idempotency rules and produce attempt-specific
  trace rows.
- Provider rollback is config-driven.
- Generation profile selection is model/profile-driven.

### 9.7 Pipeline Regression Fixtures

Use representative meals across cuisines and language patterns:

- Vietnamese meal in Vietnamese
- Vietnamese meal in English
- American meal in English
- Japanese/Korean-style meal in English
- Mediterranean meal in English
- mixed-language meal
- unaccented Vietnamese meal typed in ASCII
- English sentence containing Vietnamese dish names
- unsupported third-language input
- brand or restaurant-name input
- duplicate-name meal items/ingredients
- unmatched ingredient case
- non-food/spam case

Assertions should focus on shape, language, source behavior, anomaly rate, and
sanity bounds. Do not pretend nutrition has exact golden answers.

### 9.8 Validation Commands

Run focused Vitest tests for changed modules, then:

```bash
bunx @biomejs/biome@2.4.2 check .
```

Do not run `bun dev`, `bun run build`, or production DB push commands unless
explicitly requested.

## 10. Acceptance Criteria

The redesign is ready to roll out when:

1. Meal analysis is rate-limited before model spend.
2. Compact IDs preserve duplicate-name safety and streaming correlation.
3. English input no longer produces Vietnamese display output unless input is
   mixed/uncertain and fallback chooses Vietnamese.
4. Prompt/schema sizes are visible in admin and do not regress without an
   intentional baseline update.
5. Compressed prompts preserve required output contracts and no-preference
   leakage.
6. Vertex provider can run behind config and roll back to Developer API.
7. Explicit context caching is static-only and privacy-tested.
8. Admin traces show provider, region, token, cached-token, language, cache,
   and prompt-label metadata.
9. Each rollout phase defines review thresholds before canary enablement for
   the metrics it can affect, including token reduction, p95 latency, language
   mismatch rate, unmatched rate, anomaly rate, source-distribution drift, retry
   rate, and macro divergence where applicable.
10. Shadow/canary review stays within the phase's predeclared thresholds for
  anomaly, retry, unmatched, language-mismatch, source-distribution, and
  macro-divergence signals.
11. Docs describe the product as global food-composition analysis while keeping
    Vietnamese-specific details where they are technically relevant.

## 11. Open Implementation Decisions

These should be resolved in the implementation plan, not during this design
phase:

- Exact rate-limit windows and quotas.
- Whether rate-limit counters live entirely in Postgres or use a shared cache.
- Exact shape of lightweight guard-event telemetry for blocked requests.
- Exact language detector heuristic list and fallback order when request locale
  conflicts with profile locale.
- Whether decomposition streaming uses provisional/reset events or buffers until
  the language guard passes.
- Whether dynamic nutrition facts stay XML or move to compact JSON/columnar
  format after canary comparison.
- Exact Vertex model IDs and regions.
- Exact generation profile values per model.
- Whether explicit caching is worthwhile after compression, given model-specific
  cache minimums.
- Whether implicit caching can be disabled for dynamic requests in the selected
  Vertex integration, or must be accepted and documented.
- Exact DB column shape for provider/cache/prompt-budget metadata.

## 12. Session Retrospective Notes

Potential AGENTS.md additions after implementation planning:

- Before exposing internal links to outside testers, design app-owned rate
  limits and global model-spend circuit breakers.
- Run IDs used only for intra-request correlation should be compact and
  runtime-owned unless they must cross database or distributed-system
  boundaries.
- User-facing AI output language should be explicit and tested; do not rely on
  examples or country context to make the model mirror input language.