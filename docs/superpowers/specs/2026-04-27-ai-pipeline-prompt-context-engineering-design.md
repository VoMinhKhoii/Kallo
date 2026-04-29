# AI Pipeline — Prompt / Context / Harness Engineering Design

**Date**: 2026-04-27
**Status**: Draft (post-pushback review — ready for implementation plan)
**Predecessor**: `2026-03-31-pipeline-v2-design.md` (latency / USDA / observability)
**Scope**: Quality, correctness, and reliability layer on top of the v2 latency pipeline.

---

## 1. Context

The prior v2 design optimized latency (15-30s → 5-8s) and added USDA data, validation thresholds, and per-stage metrics. That layer is in production and works. What remains is the **estimation quality** problem: cooking-state confusion, mass-yield ambiguity, name-collision corruption between dishes, prompt-leaked preferences, and uncalibrated routing decisions. Modern prompt/context/harness techniques offer concrete improvements, but most "obvious" applications (golden datasets, LLM rerank, behavioral personalization) violate this product's principles or impose unaffordable latency. This spec defines what to ship and explicitly what to refuse.

The brainstorm grounded every decision in real code reads, two governing principles, and a rubber-duck pass that surfaced five silent-corruption traps before lock.

---

## 2. Governing Principles

These two principles are load-bearing. Every theme below derives from them. New tactics that violate either should be rejected without ceremony.

### Principle A — *LLM produces facts. Deterministic code applies preferences.*

The LLM produces estimates conditioned only on physical facts about the meal and the user's **cooking identity** (region, cooking habits, country of origin/residence). Goal, aggression, calorie targets, and behavioral history never enter the prompt. Goal-preference application — the cut/bulk/maintain transformation of bounds into a displayed value — is deterministic code's job (`lib/ai/pipeline/goal-adjustment.ts`).

Note on terminology: "unbiased" is the wrong word for the LLM's output. Cooking identity *is* signal that legitimately conditions the estimate (a "rất ít dầu" user's stir-fry is genuinely lower-fat than a "nhiều dầu" user's). The relevant epistemic guarantee is **no leakage of preference targets**, not statistical unbiasedness.

Operationally:
- Prompts must not see `goal`, `aggression`, calorie targets, body metrics, or any preference-shaped field.
- Cooking identity (`countryOfOrigin`, `countryOfResidence`, `cookingHabits`) IS allowed and intentional.
- The display layer owns the cut/bulk/maintain transformation.
- Bounds (`{ low, mid, high }`) survive the whole pipeline; collapsing them before display erases the cut/bulk affordance.

### Principle B — *Personalization captures who the user is, not what they usually do.*

Identity (region, cooking habits, body metrics) is signal — it changes how a phở looks at the table. Behavioral history (today's progress, recent meals, learned aliases, dish patterns) imposes yesterday's bias on today's meal and corrupts the LLM's honest estimate.

Operationally:
- Decomposition + nutrition prompts may include `countryOfOrigin`, `countryOfResidence`, `cookingHabits`. Nothing else from `UserContext`.
- Adaptive-compute routing decisions are **facts about this meal** (counts, anomaly flags, parse retries, candidate confidence). Never user behavioral patterns.
- Production telemetry aggregates pipeline-system facts. It never feeds back into per-user prompt customization.

---

## 3. What's NOT in this design (and why)

Stating these explicitly so the design isn't tempted into them later.

- **Golden meal datasets with hand-labeled "expected" nutrition.** Nutrition has fuzzy ground truth — every restaurant's phở is different. Hand-labeling enshrines our priors as oracle, which is the same trap as behavioral personalization.
- **LLM-as-judge over curated examples.** Useful only after a golden set exists, which we just rejected.
- **An LLM rerank layer over match candidates.** A complex meal already takes 8-10 s end-to-end. The product is not a chatbot; we cannot trade speed for marginal recall lift. Quality moves upstream into decomposition instead.
- **Cross-encoder rerank on retrieval.** Same latency argument; `gemini-embedding-001` recall is already strong on the FAO/USDA corpus.
- **Behavioral personalization (per-user correction memory, learned dish patterns, "users often eat X" priors).** Violates Principle B.
- **Hardcoded portion-uncertainty tables driving bounds.** The reason we use a strong LLM is precisely to estimate honest uncertainty over the rich onboarding context. Canned tables defeat that.
- **Skipping Call 2.** It carries cooking adjustments and dish coherence, beyond pure arithmetic.
- **Gemini context caching as a v1 deliverable.** The Gemini cached-content API is not currently integrated. If we want it, it must be specified separately with explicit lifecycle and invalidation.
- **Golden-set CI gate running real LLM per PR.** Out of principle (above) and out of cost.

---

## 4. Sequenced Plan

The rubber-duck pass surfaced that several "themes" are actually **preconditions** for others. The clean ordering is below. Each phase ships independently and is reversible.

### §0 — Foundations (must ship first; behavior-neutral)

Without these, every later phase produces silent corruption or unattributable telemetry.

#### §0.1 Stable identifiers through the pipeline

**Problem.** `assembly.ts:106` and `validation.ts:64-75` key matched-ingredient lookups by display name. With dish-wrapping (§2) the chance of "nước dùng" or "dầu ăn" appearing in two dishes increases. `Map<ingredientName, ...>` overwrites silently — wrong match attached to wrong instance, wrong anomaly raised against wrong row.

**Change.**
- Decomposition emits `mealItemId: string` per dish and `ingredientId: string` per ingredient (UUIDs scoped to the run).
- Matching, Call 2, validation, assembly, telemetry, and SSE events are keyed by `ingredientId`, never by name.
- SSE `item_macros` events carry `ingredientId` and `mealItemId` so streaming retry/replacement events (§4.4) can target the correct slot.

**Telemetry.** None. Pure plumbing.

#### §0.2 DB `state` survives the matching layer

**Problem.** Schema enforces `state IN ('raw','cooked')` and source-aware SQL returns it (`20260412143500_add_source_aware_match_functions.sql:13-20`). The TypeScript row even includes it (`source-matching.ts:35-42`). Then `MatchInfo` drops it (`source-matching.ts:48-54`). The Call 2 prompt asserts "all DB values are raw" and `assembly.ts:126-138` applies `convertCookedToRaw` blindly.

This is a real bug today: a cooked FCT row matched against cooked user grams plus a `convertCookedToRaw` step undercounts calories.

**Change.**
- `MatchInfo` carries `state: 'raw' | 'cooked'` (closed enum, DB-enforced).
- `MatchedIngredient` carries `dbState`.
- Call 2 prompt receives `dbState` and `per_100g_<dbState>` values per ingredient and is told explicitly: "this DB row is raw, user's grams are as-eaten and cooked — produce final macros for the user's portion." The LLM reconciles `(dbState, expectedState)` internally as part of its cooking adjustment. The pipeline does **not** pre-convert grams (no `convertCookedToRaw` in code).
- `expectedState` per ingredient is sourced from §2.2 (decomposition emits explicitly when it differs from the dish-method default; otherwise derived from `cookingMethod`).
- When `dbState` is `unknown`, prompt reflects that ("DB state of this row is unknown") and the ingredient is flagged low-confidence in telemetry.

**Why this changes vs. prior framing.** The original §0.2 design had runtime apply a `yieldFactor` to convert as-eaten → raw-equivalent grams. With Open Decision (§3 path B) resolved in favor of *LLM emits absolute final macros*, no factor exists in the schema. State reconciliation moves into the LLM's prompt context, where it's already doing cooking adjustment — one decision instead of two coupled ones.

**Telemetry.** Counter per `(dbState, expectedState)` cell. Rate of `unknown` rows hitting the pipeline. Tracked via `db_state_unknown_fires` in `pipeline_runs`.

#### §0.3 Prompt + schema versioning

**Problem.** Today there is no `promptVersion` constant. `PipelineMetrics` does not record which model or prompt produced a given run. Cache invalidation (§4.3) and shadow A/B (§5.2) need both.

**Change.**
- `lib/ai/prompts/decomposition.ts` exports `DECOMPOSITION_PROMPT_VERSION` (semver-ish: `'2.0.0'`).
- `lib/ai/prompts/nutrition.ts` exports `NUTRITION_PROMPT_VERSION`.
- `lib/ai/pipeline/schemas.ts` exports `DECOMPOSITION_SCHEMA_VERSION`, `NUTRITION_SCHEMA_VERSION`.
- Bumping any of these is a code change; cache keys and telemetry pick them up automatically.

#### §0.4 Telemetry contract — `pipeline_runs` table

**Problem.** Today metrics go through `console.info`. The proposed KPI rollups (§5.1) need durable structured data.

**Change.** New Drizzle table `pipeline_runs` with columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `created_at` | timestamptz | |
| `user_id_hash` | text | SHA-256 of `user_id`; **never raw user id** |
| `request_id` | text | join key with `pipeline_requests` if needed |
| `decomposition_prompt_version` | text | from §0.3 |
| `nutrition_prompt_version` | text | |
| `decomposition_schema_version` | text | |
| `nutrition_schema_version` | text | |
| `model_call1` | text | |
| `model_call2` | text | |
| `escalated` | boolean | did Call 2 use the escalation model |
| `cache_hit_l4` | boolean | decomposition cache hit |
| `retry_count` | smallint | |
| `decompose_ms` | int | |
| `match_ms` | int | |
| `nutrition_ms` | int | |
| `total_ms` | int | |
| `ingredient_count` | smallint | |
| `matched_count` | smallint | |
| `unmatched_count` | smallint | |
| `anomaly_types` | text[] | from `validation.ts.AnomalyType` |
| `pre_match_alias_hits` | smallint | counter |
| `cooked_to_raw_factor_fires` | smallint | retirement metric for legacy `convertCookedToRaw` path |
| `density_envelope_fires` | smallint | §1.4 — out-of-range macro density on LLM output |
| `macro_inconsistent_fires` | smallint | §1.3 — 4·P+4·C+9·F kcal identity violation |
| `db_state_unknown_fires` | smallint | from §0.2 |
| `retry_step2_count` | smallint | retry count for streaming-buffer telemetry guard (§4.4) |
| `prompt_personalization_fields` | text[] | reflective: which keys actually entered the prompt |

**Privacy guard.** `user_id_hash` only. No raw input. No `userContextJson`. The handling of the existing `pipeline_requests.raw_input` is in **Open Decision A** below.

#### §0.5 Existing `pipeline_requests` table — privacy reckoning

**Problem.** `pipeline_requests` (migration `20260406033451`) requires `raw_input` and stores `userContextJson` (which includes `goal`, `aggression`). The clean privacy story for §5 is false until this table changes.

**Change.** See **Open Decision A**.

#### §0.6 Raw LLM output logging — debug substrate for the future audit dashboard

**Why.** With §1's resolution that the LLM emits absolute final macros (no factors, no audit-friendly intermediate values), the only way to debug a wrong estimate is to inspect the LLM's actual output side-by-side with what we sent it. The team's stated plan is to build a debugging dashboard later that uses domain knowledge to vet outputs against inputs. That dashboard needs durable, structured raw output.

**Change.** New table `pipeline_llm_outputs` (separate from `pipeline_runs` to keep the metrics table lean and to apply distinct retention/access controls):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `created_at` | timestamptz | |
| `request_id` | text | join key — links to `pipeline_runs.request_id` and `pipeline_requests` |
| `user_id_hash` | text | SHA-256 hashed; never raw |
| `decomposition_prompt_version` | text | from §0.3 |
| `nutrition_prompt_version` | text | |
| `decomposition_output_json` | jsonb | parsed Call 1 output (mealItems, ingredients) |
| `nutrition_output_json` | jsonb | parsed Call 2 output (per-ingredient bounded macros) |
| `model_call1` | text | |
| `model_call2` | text | |
| `escalated` | boolean | |

**Privacy & retention.** 30-day TTL by default. Access restricted to engineering. The raw user input itself stays in `pipeline_requests` per Open Decision A; this table holds *model outputs* only, but is still subject to the same access controls because outputs can echo input fragments.

**No reverse-feed.** This table feeds the manual debug dashboard only. It is **not** a source for prompts, personalization, or retraining (Principle B).

---

### §3 — Prompt personalization is type-safe (single phase)

Originally framed as "null change." The prior pushback round found `nutrition.ts:138-144` already contains preference-shaped framing in the prompt. Real change required.

This phase ships as a single unit (no §3a/§3b split). The pre-production status of this spec means there's no live user base to fly blind on; the shadow runner (§5.2) is being built as **post-launch** regression infrastructure for *future* prompt changes, not as a baseline gate for this one.

#### §3.1 Type-narrow `PromptPersonalizationContext`

```ts
// lib/ai/prompts/types.ts
export type PromptPersonalizationContext = Pick<
  UserContext,
  'countryOfOrigin' | 'countryOfResidence' | 'cookingHabits'
>;
```

Prompt builders accept this type. They cannot reach `goal`, `aggression`, calorie targets, body metrics — TypeScript enforces this at compile time.

#### §3.2 Remove preference-shaped framing from nutrition prompt

`nutrition.ts:138-144` currently uses goal-adjustment language ("for cutting users…"). Rewrite to ask for honest uncertainty bounds. Bounds carry information; the `goal-adjustment.ts` layer applies preference. Document the principle inline as a comment block referencing this spec.

Same documentation comment block at top of `decomposition.ts`.

#### §3.3 Sentinel-value tests

In addition to compile-time safety, runtime tests build prompts with sentinel values:

```ts
const ctx: UserContext = {
  goal: 'cutting',
  aggression: 0.8,
  // ...
};
const prompt = buildNutritionPrompt({ /* … */ }, ctx);
expect(prompt).not.toMatch(/cutting|bulking|maintaining|aggression/i);
expect(prompt).not.toMatch(/0\.8/); // raw aggression number
```

Brittle string-matching is acceptable here because we want it to fire if the principle is violated.

---

### §1 — Deterministic compute boundary (LLM emits absolute macros)

LLM emits absolute final bounded macros for the user's portion. Runtime aggregates and validates. **No factor decomposition in the schema.**

This is a significant pivot from earlier drafts that had the LLM emit `yieldFactor` + per-macro `nutrientFactor`. The pushback rejected that approach for two reasons: (1) yield and nutrient factors are physically coupled (frying drives yield down while driving fat up — independent bounds can drift inconsistent without §1.3 catching it), and (2) the team's debugging strategy is "let LLM do its job, then verify outputs against inputs via a dashboard" — which favors absolute outputs over factor decompositions whose internal coherence is itself another failure mode. Auditability moves from the schema into §0.6 raw-output logging.

This also matches the **current** production prompt at `nutrition.ts:124-169`, which already asks the LLM to produce final adjusted absolute macros. §1 codifies that contract; the work is in tightening validation, not changing the unit.

#### §1.1 Schema — single ingredient nutrition shape

```ts
type IngredientNutrition = {
  ingredientId: string;          // §0.1 stable id
  matchedDbId?: number;          // present iff matched against FAO/USDA row
  // Absolute final macros for the as-eaten portion this ingredient represents
  caloriesKcal: BoundedEstimate; // {low, mid, high}
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
  // Required for unmatched, optional for matched (LLM may explain dish-context inferences)
  uncertaintyReason?: string;
};
```

Single shape — no discriminated union. Matched vs unmatched is a property of provenance (`matchedDbId` present?), not of the nutrition contract. The runtime treats both identically: sum bounded estimates across ingredients to dish/meal totals.

#### §1.2 Runtime aggregation in `mergeNutrition`

```text
for each ingredient:
  pass through {low, mid, high} for each macro

dish_total.macro = bounded_sum(ingredient.macro for ingredient in dish.ingredients)
meal_total.macro = bounded_sum(dish_total.macro for dish in meal.dishes)
```

`bounded_sum` adds `low`, `mid`, `high` channels independently. No multiplication, no factor application, no state-aware branching at this layer — the LLM produced macros for the as-eaten portion already.

#### §1.3 Macro consistency invariant (per ingredient)

The LLM's four bounded macros must satisfy the kcal identity within tolerance:

```text
estimated_kcal_from_macros.mid = 4 × proteinG.mid + 4 × carbohydrateG.mid + 9 × fatG.mid
abs(caloriesKcal.mid - estimated_kcal_from_macros.mid) / max(caloriesKcal.mid, 1) < 0.20
```

20% tolerance accounts for fiber, alcohol, rounding. Violation → `macro_inconsistent_fires` increment, anomaly type `macro_inconsistent`, retry path (§4.2).

The same identity is checked on `low` and `high` channels with the same tolerance. Independent low/high inconsistency triggers the same anomaly.

#### §1.4 Macro density envelope — out-of-range is an anomaly, not silent clamp

Per ingredient, `density = macro / grams × 100` is computed and bounds-checked:

| Macro | Per-100g cap (high bound) |
|---|---|
| caloriesKcal | ≤ 900 (pure fat ≈ 900 kcal/100g) |
| proteinG | ≤ 100 |
| carbohydrateG | ≤ 100 |
| fatG | ≤ 100 |

`low` channels must be ≥ 0. Any breach → `density_envelope_fires++`, anomaly type `density_envelope`, retry/escalation per §4. On repeated breach after retry, clamp to envelope and mark ingredient confidence `low` — never silently coerce to a "reasonable" value.

This replaces the prior `factor_envelope_fires` concept. Density envelope is unit-stable across portion sizes and directly observable on the LLM's output.

#### §1.5 Retire `COOKED_TO_RAW_FACTOR` and `convertCookedToRaw`

Both are now redundant: the LLM receives `dbState` and as-eaten grams in its prompt context (§0.2) and produces final adjusted macros without a runtime conversion step. The legacy code path stays for one release as instrumented fallback; `cooked_to_raw_factor_fires` records every time the legacy path is invoked. Retire when fire-rate < 5% of meals over 7 days.

---

### §2 — Decomposition quality upstream

No rerank layer. Quality moves into decomposition, validated by structured output, scored by retrieval preference boosts.

#### §2.1 Dish-wrapped schema

```ts
type DecomposedDish = {
  mealItemId: string;
  name: string;
  cookingMethod: string;       // free-form (luộc, kho, chiên, nướng, hấp, xào, ...)
  cuisineNote?: string;        // free-form ("Huế-style", "northern beef pho", ...)
  ingredients: DecomposedIngredient[];
};

type DecomposedIngredient = {
  ingredientId: string;
  rawName: string;             // exactly what the model saw / inferred from user input
  canonicalName: string;       // disambiguated to FCT vocabulary ("Cá quả", not "cá lóc")
  quantity: number;
  unit: string;
  expectedState?: 'raw' | 'cooked';   // explicit override; otherwise derived from cookingMethod
};
```

Hard enums only where DB enforces (`state`). Cuisine/cooking-method stay free-form — closed enums for those are inevitably wrong on edge cases.

**Why no `sourcePrior` / `sourceOverride`.** Earlier drafts had the LLM emit a per-dish `sourcePrior: 'fao' | 'usda' | 'either'` and per-ingredient `sourceOverride`. Removed: the LLM does not know what is actually in our DB. Its source guess is a training-data prior loosely correlated with our schema, and a wrong guess (e.g., emitting `'fao'` for cá hồi/salmon, which lives in USDA) silently degrades match quality if any code path treats it as a routing hint. The matching layer (§2.3) has DB visibility and applies source preference at rank-time, where the decision is data-driven. Telemetry from §2.5 still captures `canonicalName` agreement, which is a more honest signal than source guesses.

Token reduction comes from hoisting dish-level fields. No claim about exact percentage until measured against production-like inputs.

#### §2.2 Per-ingredient `expectedState` is the source of truth

Mixed-method dishes are common in Vietnamese cuisine (`bún thịt nướng`, `cơm gà xối mỡ`, `canh chua cá chiên`). Dish-level `cookingMethod` is a hint, not a determiner. LLM emits per-ingredient `expectedState` whenever it would differ from a naive dish-method derivation.

If `expectedState` is omitted, runtime derives from `cookingMethod` via a `COOKING_METHOD_STATE` lookup with an `unknown` fallback (telemetry, low confidence).

#### §2.3 State preference as **rank tie-breaker**, not score arithmetic

The pushback flagged that FAO threshold 0.8 vs USDA 0.7, vector vs fuzzy similarity, are not on comparable scales. A boolean score boost can defeat a much better semantic match. With `sourcePrior` removed (§2.1), the only preference signal at rank time is **state-match**.

`pickBestSource` change:

1. Collect candidates from FAO + USDA, vector + fuzzy.
2. Each candidate keeps original similarity score and source/vector-or-fuzzy provenance.
3. Compute primary rank by similarity within source.
4. Apply tie-breakers in this order: **state-match > similarity score**.
5. Telemetry preserves all original scores and per-candidate source so calibration decisions are data-driven.

Source preference is intentionally not a tie-breaker. If you want USDA-Vietnam parity, that is a data-curation problem (add the missing FAO row), not a routing problem.

#### §2.4 RRF fusion is gated behind measurement, not v1 default

Today vector returns early on hit; RRF would require running both vector and fuzzy always (extra DB load) and may not help if the two signals are highly correlated.

**Plan.**
- Phase A: log both candidate lists for a sample of meals (feature flag, off in production).
- Measure: `% of ingredients where top vector ≠ top fuzzy`, precision delta on changed matches, latency cost.
- Phase B: ship RRF only if Phase A shows meaningful changed-match precision lift.

Keep RRF behind a feature flag throughout; default off.

#### §2.5 `canonicalName` validates against FCT vocabulary

LLM emits `canonicalName` for matched ingredients. Runtime validates against the FAO+USDA name set (already in memory for embedding cache). Misses become `pre_match_alias_hits` telemetry. When a `canonicalName` consistently misses but a `PRE_MATCH_ALIAS` would have helped, we have data to retire that alias entry.

Aggregate-not-per-user telemetry only.

#### §2.6 `confidence: 'ambiguous'` is logged with structured flags

Closed-enum side-channel:

```ts
ambiguityFlags?: Array<
  | 'multiple_dish_interpretations'
  | 'unspecified_quantity'
  | 'cross_cuisine_ingredient'
  | 'state_inferred_no_method'
>;
```

Not in main confidence type yet; logged for retirement decisions.

---

### §4 — Adaptive compute (after §0 and §1 ship)

Models route by **facts about this meal**. Never by user behavior, region, or goal.

#### §4.1 Default model upgrade

| Constant | Today | New |
|---|---|---|
| `DECOMPOSITION_MODEL` | `gemini-2.5-flash-lite` | `gemini-3.1-flash-lite-preview` |
| `NUTRITION_MODEL` | `gemini-2.5-flash-lite` | `gemini-3.1-flash-lite-preview` |
| `ESCALATION_MODEL` | (unused) | `gemini-3-flash` |

Ships **only after** §0 versioning and the shadow runner exist. Model-version change is recorded in `pipeline_runs`; cost/anomaly/latency comparison is computable retrospectively.

#### §4.2 `pickComputePolicy` — narrow input type

```ts
type MealFactsForComputePolicy = {
  ingredientCount: number;
  matchedCount: number;
  unmatchedCount: number;
  anomalyTypes: ReadonlyArray<AnomalyType>;
  parseRetryCount: number;
  candidateConfidenceSummary: { high: number; medium: number; low: number; ambiguous: number };
};

function pickComputePolicy(
  facts: MealFactsForComputePolicy
): { call2Model: ModelId; escalateOnRetry: boolean };
```

Tests assert this function has no access to `UserContext`, `rawInput`, user id, or region. Lint rule prevents accidental coupling.

Triggers:
- `unmatched / total > 0.5` → escalate Call 2 upfront.
- Anomaly retry → escalate (instead of re-running same model).
- Otherwise → default model.

Cost guardrail: alert if escalation rate > 20% of meals over 24h.

#### §4.3 L4 decomposition input cache

Key: `hash(rawInputNormalized + decompositionContextHash + DECOMPOSITION_PROMPT_VERSION + DECOMPOSITION_SCHEMA_VERSION)`.

`decompositionContextHash` is computed over an **explicit allowlist**:

```ts
function decompositionContextHash(ctx: PromptPersonalizationContext): string {
  return sha256(JSON.stringify({
    countryOfOrigin: ctx.countryOfOrigin,
    countryOfResidence: ctx.countryOfResidence,
    cookingHabits: ctx.cookingHabits,
  }));
}
```

`goal`, `aggression`, calorie/macro targets, body metrics, behavioral history are explicitly excluded. Tests verify hash inputs (rubber-duck #16).

TTL 7 days. Eviction by LRU + age. `cache_hit_l4` recorded per run.

#### §4.4 Streaming — keep current incremental behavior with retry-rate guard

Today (`orchestrator.ts:148-154, 262, 313-314, 360`) the pipeline streams two event kinds incrementally:

- `item_name` — emitted from Call 1's streaming JSON as soon as a meal-item name parses (~1-2s after request start). Names come from decomposition and are not retried for nutrition anomalies, so they are always correct.
- `item_macros` — emitted per-item from Call 2 as boundaries are detected. On `retry_step2`, `lastExtractedCount` resets and the second Call 2 re-emits `item_macros`; the client overwrites by index. Users see a brief "first answer → corrected answer" flicker on retry-affected meals.

**Decision: keep this behavior.** Earlier drafts proposed buffering all `item_macros` until a validation gate passed. That would regress happy-path first-byte by 3-5s and retry-path first-byte by 8-10s, against an unverified UX claim that flicker erodes trust more than delay. Without user evidence, the latency cost is not justified.

**Retry-rate telemetry guard.** `pipeline_runs.retry_step2_count` (§0.4) tracks per-meal retry counts. If the rolling 7-day rate of meals with `retry_step2_count > 0` exceeds **10%**, revisit the buffer-vs-stream trade-off with real data on how often the flicker actually fires.

**§0.1 stable IDs make retry replacement safe.** With `ingredientId` keyed events (§0.1), the client can correlate first-pass and retry-pass macros on the *same logical slot* even if ingredient ordering shifts between Call 2 attempts.

#### §4.5 Gemini context caching is **out of scope** for v1

The current `gemini.ts` does not call the cached-content API. Sortable-prefix prompts may help provider-side implicit caching but that is not the same feature. If we want explicit cached content, it ships as a separate spec with lifecycle, version-keyed invalidation, and cache-creation-failure fallback.

---

### §5 — Eval flywheel (built on §0)

Three pieces. KPI rollup and pairing-scaffold ship with §0 foundations; the shadow runner is post-launch regression infrastructure, not a precondition for any phase in this spec.

#### §5.1 KPI rollup queries

`scripts/eval-kpis.sql` — manually-run views over `pipeline_runs`:

- p50, p95, p99 latency per (model, prompt version)
- anomaly rate per `AnomalyType`
- escalation rate, cache hit rate, retry rate
- unmatched rate, density-envelope fire rate, macro-inconsistent fire rate, alias hit rate, cooked-to-raw fire rate
- DB-state-unknown rate per ingredient

Drift alerting is a query that flags any rate moving >2σ from 7-day baseline. Not paging; visible-when-reviewed. Real alerting deferred until a need is demonstrated.

#### §5.2 Shadow A/B runner — post-launch regression infrastructure

Built for **future** prompt/model/schema changes. Not a precondition for shipping §1, §3, or §4 in this spec — those ride on `pipeline_runs` + `pipeline_llm_outputs` telemetry alone, given the pre-production status. A v2-pipeline change behind a feature flag. The runner:

- Sampling: 5% of production traffic by default (configurable).
- **Best-effort and isolated.** Shadow runs **after** the primary response is sent (queue or post-response continuation). Never blocks user.
- Separate `MATCH_CONCURRENCY` budget — does not contend with primary's cap of 2.
- Abort guards:
  - Primary p95 exceeds threshold over 5-min window → shadow disables itself for 30 min.
  - DB pool wait exceeds threshold → shadow skips run.
  - Embedding API rate-limit error → shadow skips.
- Records paired output: matched DB IDs, unmatched ingredient names, per-ingredient bounded macros, total-macro `BoundedEstimate`s, anomaly types. **No raw input** in this pair record (it's derivable from `request_id` join with the privacy-controlled debug table — see Open Decision A).
- Divergence detection: macro delta > 30%, ingredient-count delta > ±2, anomaly-type delta. Surfaces in a dedicated query template.

#### §5.3 What is not built

Reaffirming §3 of this doc: no golden datasets, no LLM-as-judge over labeled pairs, no behavioral-feedback loop.

---

## 5. Open Decisions Requiring User Input

These have safe defaults but the user should weigh in.

### Open Decision A — `pipeline_requests.raw_input` privacy stance

The existing table stores raw meal input and full `userContextJson`. The clean §5 privacy story is false until this is addressed. Three options, ordered by my preference:

1. **Split debug-from-analytics retention.** Keep `pipeline_requests` for short-window operational debugging (7-day TTL, restricted access). New `pipeline_runs` is the analytics/eval source, and `pipeline_llm_outputs` (§0.6) is the debug-dashboard source with 30-day TTL. Documented access controls. *Preferred — preserves debuggability with explicit TTL.*
2. **Scrub raw_input.** Drop the column or store a hash-or-category. Lose ability to reproduce production bugs from raw input. *Cleanest privacy, worst debuggability.*
3. **Keep status quo, document the leak in this spec.** *Honest but unsatisfying — goes against the privacy claim of §5.*

### Open Decision B — Shadow A/B sampling rate

Default 5% of traffic. With the rubber-duck's #9 isolation requirements, even 5% can be bursty. Options: 1%, 5%, dynamic (autoscale based on primary p95).

I lean static 5% with abort-on-degradation as the safety valve, simplest to reason about.

---

## 6. Rollout Sequencing

Each phase ships independently and is reversible. Telemetry must accompany each phase.

| Phase | Content | Risk | Reversibility |
|---|---|---|---|
| **1. §0 Foundations** | Stable IDs, state propagation (LLM-side reconciliation), prompt/schema versioning, `pipeline_runs` table, `pipeline_llm_outputs` table, Decision A resolution | Low — behavior-neutral plumbing | Drop migration, revert code |
| **2. §3 Type-safe prompts** | `PromptPersonalizationContext` type, prompt rewrite at `nutrition.ts:138-144`, sentinel tests, `dbState`-aware prompt context (§0.2) | Low (pre-production) — prompt change behind versioning, observable via `pipeline_llm_outputs` | Revert; old prompt version still queryable |
| **3. §1 Absolute-macro schema + validators** | Single `IngredientNutrition` shape, runtime aggregation, macro-consistency invariant, density envelope, retire `convertCookedToRaw` path | Medium — semantic tightening of nutrition contract | Schema versioning; flag-flip rollback |
| **4. §5.2 Shadow runner** | Off-by-default infrastructure, abort guards, paired-output store — built for **future** post-launch change validation | Low — disabled by default | Feature flag off |
| **5. §4 Model upgrade + cache + policy** | New default model, escalation routing, L4 cache, narrow `MealFactsForComputePolicy` | Medium — distributional shift | Constants flip back; cache flushable |
| **6. §2 Dish-wrapped decomposition** | New schema (no `sourcePrior`/`sourceOverride`), `canonicalName`, state-only tie-breaker, `expectedState` per ingredient | Medium — schema change with prompt rewrite | Schema version flips; rollback path through versioning |
| **7. §2.4 RRF measurement → maybe RRF** | Phase A logging only; Phase B feature-flagged ship-or-no-ship decision | Low (phase A) / Medium (phase B) | Flag controlled |

§4's model upgrade may be **bundled with §1** if pre-launch testing shows them stable together.

---

## 7. Tech-Debt Safeguards

These exist to prevent the design from rotting.

- **Hard enums only where DB enforces closed sets.** Cuisine/cooking-method/cuisineNote stay free-form. Adding a closed enum requires a corresponding DB constraint or it doesn't ship.
- **`canonicalName` is validated against FCT vocabulary.** Misses become an alias-retirement signal, not invisible failures.
- **No silent clamps.** Out-of-envelope densities, unknown DB states, validation breaches are all telemetry events.
- **Telemetry is structured at the source.** No deriving critical fields from log-string parsing. The `pipeline_runs` and `pipeline_llm_outputs` schemas are the contract.
- **Pure routing function with narrow input type.** `pickComputePolicy(MealFactsForComputePolicy)` cannot drift into receiving `UserContext`.
- **Cache keys include `*Version` constants.** Bumping the constant invalidates the cache — no manual flush ritual.
- **Aggregate-not-per-user telemetry.** Every metric is system-level. No per-user behavioral inference.
- **Raw LLM outputs are debug substrate, not training input.** `pipeline_llm_outputs` (§0.6) feeds the manual debug dashboard only; it never re-enters the prompt or the personalization layer (Principle B).

---

## 8. Success Indicators

Honest, observable signals — not aspirational metrics.

- **Correctness.** `density_envelope_fires` rate stable and < 2% of meals after week 4. `db_state_unknown_fires` stable and < 5% (most rows have known state). `macro_inconsistent_fires` rate < 1%.
- **Performance.** End-to-end p95 not worse than today after §1 + §4 ship. `retry_step2` rate < 10% (streaming-flicker guard from §4.4). Shadow divergence on macro totals < 30% in 95% of paired runs once shadow is live.
- **Tech-debt retirement.** `pre_match_alias_hits` declining quarterly as the LLM internalizes vocabulary. `cooked_to_raw_factor_fires` reaches < 5% (gate for retirement).
- **Principle adherence.** Sentinel tests pass forever. `prompt_personalization_fields` telemetry never includes `goal` or `aggression`. `pipeline_llm_outputs` access logs show no application-layer reads (debug dashboard only).
- **Shadow A/B utility.** When a future change ships, divergence query yields actionable signal (real misses, not noise).

What we don't promise: a target accuracy number. Nutrition has fuzzy ground truth; promising a number invites Goodharting.

---

## 9. Implementation Plan Reference

A detailed implementation plan with file-level changes will be produced via the `writing-plans` skill once this spec is approved.

---

## 10. References

- `lib/ai/pipeline/orchestrator.ts` — central pipeline; touched by §0–§4
- `lib/ai/pipeline/schemas.ts` — single `IngredientNutrition` shape (§1), dish-wrapped decomposition (§2)
- `lib/ai/pipeline/validation.ts` — anomaly thresholds; density envelope (§1.4), macro consistency (§1.3)
- `lib/ai/pipeline/assembly.ts` — runtime bounded aggregation (§1.2); `convertCookedToRaw` retirement (§1.5)
- `lib/ai/pipeline/goal-adjustment.ts` — the deterministic preference layer (Principle A)
- `lib/ai/prompts/decomposition.ts`, `lib/ai/prompts/nutrition.ts` — §3 rewrite
- `lib/ai/matching/cascade.ts`, `lib/ai/matching/source-matching.ts`, `lib/ai/matching/aliases.ts` — §2
- `lib/ai/constants.ts` — `COOKED_TO_RAW_FACTOR` retirement (§1.5)
- `lib/db/schema.ts` — DB constraints (`state`, `source_id` FK)
- `lib/ai/types.ts` — `UserContext`; `PromptPersonalizationContext` derives via `Pick`
- `supabase/migrations/20260406033451_add_pipeline_requests_table.sql` — Open Decision A target
