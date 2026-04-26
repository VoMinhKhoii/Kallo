# AI Pipeline — Prompt / Context / Harness Engineering Design

**Date**: 2026-04-27
**Status**: Draft (post-rubber-duck, awaiting user review)
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

The model gives honest, unbiased estimates with appropriate uncertainty bounds. Deterministic code (`lib/ai/pipeline/goal-adjustment.ts`) consumes those bounds and applies the user's goal/aggression to compute a **displayed** value. Preferences never enter the prompt.

Operationally:
- Prompts must not see `goal`, `aggression`, calorie targets, or any field that biases honesty.
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
- Call 2 prompt receives `dbState` per ingredient and is told explicitly: "this row is raw" or "this row is cooked".
- Deterministic scaling in assembly branches on `(dbState, expectedState)`:
  | DB state | User as-eaten state | Action |
  |---|---|---|
  | raw | cooked | apply `yieldFactor` to convert as-eaten → raw-equivalent grams, then scale |
  | cooked | cooked | scale directly by as-eaten grams |
  | raw | raw | scale directly |
  | cooked | raw | rare; apply inverse `yieldFactor` with telemetry, low confidence |
  | unknown | * | telemetry + low confidence; no silent default |

**Telemetry.** Counter per `(dbState, expectedState)` cell. Rate of `unknown` rows hitting the pipeline.

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
| `cooked_to_raw_factor_fires` | smallint | retirement metric |
| `factor_envelope_fires` | smallint | §1.4 |
| `db_state_unknown_fires` | smallint | from §0.2 |
| `prompt_personalization_fields` | text[] | reflective: which keys actually entered the prompt |

**Privacy guard.** `user_id_hash` only. No raw input. No `userContextJson`. The handling of the existing `pipeline_requests.raw_input` is in **Open Decision A** below.

#### §0.5 Existing `pipeline_requests` table — privacy reckoning

**Problem.** `pipeline_requests` (migration `20260406033451`) requires `raw_input` and stores `userContextJson` (which includes `goal`, `aggression`). The clean privacy story for §5 is false until this table changes.

**Change.** See **Open Decision A**.

---

### §3 — Prompt personalization is type-safe (must ship before §1's prompt rewrite)

Originally framed as "null change." The rubber-duck found `nutrition.ts:138-144` already contains preference-shaped framing in the prompt. Real change required.

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

### §1 — Deterministic compute boundary

LLM emits factor objects; runtime does the arithmetic. Two material refinements over the original brainstorm framing.

#### §1.1 Three-factor decomposition (replaces single `cookingFactor`)

The rubber-duck identified that one `cookingFactor` cannot carry both mass-yield and nutrient-retention semantics. Rice example: 150g cooked rice × raw FCT data needs ~0.38 mass factor. If LLM emits `cookingFactor: 1.0` reasoning "cooking doesn't change macros," runtime overcounts ~2.6×.

The schema declares each semantic separately:

```ts
type MatchedIngredientFactors = {
  ingredientId: string;
  kind: 'matched';
  // Whose grams these are (decomposition output convention)
  massBasis: 'as_eaten' | 'raw_equivalent';
  // Mass conversion: as-eaten grams → DB-state-equivalent grams
  // (Only meaningful when massBasis !== dbState; otherwise 1.0 with telemetry)
  yieldFactor: BoundedEstimate; // {low, mid, high}
  // Nutrient retention/transformation per macro, applied AFTER mass scaling
  nutrientFactor: {
    kcal: BoundedEstimate;
    protein: BoundedEstimate;
    carbs: BoundedEstimate;
    fat: BoundedEstimate;
  };
  // Optional: explicit added fat/sauce/oil that isn't in DB at all
  addedFat?: { grams: BoundedEstimate; reason: string };
};

type UnmatchedIngredientNutrition = {
  ingredientId: string;
  kind: 'unmatched';
  // No DB to scale against; LLM emits absolute bounded macros for the as-eaten portion
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbsG: BoundedEstimate;
  fatG: BoundedEstimate;
  uncertaintyReason: string;
};

type IngredientNutritionResult = MatchedIngredientFactors | UnmatchedIngredientNutrition;
```

Discriminated union is explicit so runtime never silently invents per-100g for an unmatched ingredient.

#### §1.2 Runtime arithmetic in `mergeNutrition`

For matched ingredients:

```text
db_equivalent_grams = grams_as_eaten × yieldFactor   // skip if massBasis matches dbState
base_per100g_for_macro = db.macro_per_100g
scaled_macro = (db_equivalent_grams / 100) × base_per100g_for_macro × nutrientFactor.macro
final_macro = scaled_macro + (addedFat → macro contribution if applicable)
```

All bounded propagation through `low/mid/high` channels. `final.mid` is the point estimate; bounds enable `goal-adjustment.ts` cut/bulk display.

For unmatched ingredients: pass through `BoundedEstimate` directly; no arithmetic.

#### §1.3 Macro consistency invariant

Independent factor bounds per macro can produce kcal incompatible with protein/carbs/fat. Add a soft validation check:

```text
estimated_kcal_from_macros = 4*protein + 4*carbs + 9*fat
abs(kcal - estimated_kcal_from_macros) / kcal < 0.20  // 20% tolerance for fiber/alcohol/rounding
```

Violation → `factor_envelope_fires` increment, anomaly type `macro_inconsistent`, retry path.

#### §1.4 Envelope fallback is an anomaly, not a silent clamp

If LLM emits `yieldFactor` outside `[0.2, 5.0]` or any `nutrientFactor` outside `[0.3, 3.0]`:

- **First occurrence in run:** mark `factor_envelope_fires++`, treat as anomaly, retry Call 2 with explicit re-prompt about the offending ingredient (escalate per §4).
- **Repeated occurrence after retry:** clamp to range, set ingredient confidence to `low`, surface in telemetry. Never collapse to `1.0` invisibly.

#### §1.5 Retire `COOKED_TO_RAW_FACTOR`

Now redundant with `yieldFactor`. Stays for one release as instrumented fallback (`cooked_to_raw_factor_fires`). Retire when fire-rate < 5% of meals over 7 days.

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
  sourcePrior: 'fao' | 'usda' | 'either';
  ingredients: DecomposedIngredient[];
};

type DecomposedIngredient = {
  ingredientId: string;
  rawName: string;             // exactly what the model saw / inferred from user input
  canonicalName: string;       // disambiguated to FCT vocabulary ("Cá quả", not "cá lóc")
  quantity: number;
  unit: string;
  expectedState?: 'raw' | 'cooked';   // explicit override; otherwise derived from cookingMethod
  sourceOverride?: 'fao' | 'usda';    // explicit override of dish-level sourcePrior
};
```

Hard enums only where DB enforces (`state`, `source_id`). Cuisine/cooking-method stay free-form — closed enums for those are inevitably wrong on edge cases.

Token reduction comes from hoisting dish-level fields. No claim about exact percentage until measured against production-like inputs (rubber-duck #19).

#### §2.2 Per-ingredient `expectedState` is the source of truth

Mixed-method dishes are common in Vietnamese cuisine (`bún thịt nướng`, `cơm gà xối mỡ`, `canh chua cá chiên`). Dish-level `cookingMethod` is a hint, not a determiner. LLM emits per-ingredient `expectedState` whenever it would differ from a naive dish-method derivation.

If `expectedState` is omitted, runtime derives from `cookingMethod` via a `COOKING_METHOD_STATE` lookup with an `unknown` fallback (telemetry, low confidence).

#### §2.3 Source/state preference as **rank tie-breakers**, not score arithmetic

The rubber-duck flagged that FAO threshold 0.8 vs USDA 0.7, vector vs fuzzy similarity, are not on comparable scales. A boolean score boost can defeat a much better semantic match.

`pickBestSource` change:

1. Collect candidates from FAO + USDA, vector + fuzzy.
2. Each candidate keeps original similarity score and source/vector-or-fuzzy provenance.
3. Compute primary rank by similarity within source.
4. Apply tie-breakers in this order: state-match > source-match-with-prior > similarity score.
5. Telemetry preserves all original scores so calibration decisions are data-driven.

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

#### §4.4 Streaming retry — buffered until first validation pass

Today Call 2 emits per-item nutrition during the chunk stream; if anomaly classifier later forces retry, the UI has already shown bad numbers.

**v1 behavior.** Buffer item-macro events until the parsed Call 2 result passes the basic validation gate (no `total_calories` anomaly, no `factor_envelope_fires` triggered). On retry/escalation, the buffered events are dropped and replaced with the new run's events. Streaming UX becomes "incremental once we know the result will stand."

Trade-off: slightly later first-byte for item nutrition. Worth it to avoid showing wrong then corrected numbers, which erodes trust more than a minor delay.

#### §4.5 Gemini context caching is **out of scope** for v1

The current `gemini.ts` does not call the cached-content API. Sortable-prefix prompts may help provider-side implicit caching but that is not the same feature. If we want explicit cached content, it ships as a separate spec with lifecycle, version-keyed invalidation, and cache-creation-failure fallback.

---

### §5 — Eval flywheel (built on §0)

Three pieces. Two ship in v1, one is precondition for §1/§4 rollout.

#### §5.1 KPI rollup queries

`scripts/eval-kpis.sql` — manually-run views over `pipeline_runs`:

- p50, p95, p99 latency per (model, prompt version)
- anomaly rate per `AnomalyType`
- escalation rate, cache hit rate, retry rate
- unmatched rate, factor-envelope fire rate, alias hit rate, cooked-to-raw fire rate
- DB-state-unknown rate per ingredient

Drift alerting is a query that flags any rate moving >2σ from 7-day baseline. Not paging; visible-when-reviewed. Real alerting deferred until a need is demonstrated.

#### §5.2 Shadow A/B runner — precondition for §1 / §4 rollout

A v2-pipeline change behind a feature flag. The runner:

- Sampling: 5% of production traffic by default (configurable).
- **Best-effort and isolated.** Shadow runs **after** the primary response is sent (queue or post-response continuation). Never blocks user.
- Separate `MATCH_CONCURRENCY` budget — does not contend with primary's cap of 2.
- Abort guards:
  - Primary p95 exceeds threshold over 5-min window → shadow disables itself for 30 min.
  - DB pool wait exceeds threshold → shadow skips run.
  - Embedding API rate-limit error → shadow skips.
- Records paired output: matched DB IDs, unmatched ingredient names, total-macro `BoundedEstimate`s, anomaly types, factor values. **No raw input** in this pair record (it's derivable from `request_id` join with the privacy-controlled debug table — see Open Decision A).
- Divergence detection: macro delta > 30%, ingredient-count delta > ±2, anomaly-type delta. Surfaces in a dedicated query template.

#### §5.3 What is not built

Reaffirming §3 of this doc: no golden datasets, no LLM-as-judge over labeled pairs, no behavioral-feedback loop.

---

## 5. Open Decisions Requiring User Input

These have safe defaults but the user should weigh in.

### Open Decision A — `pipeline_requests.raw_input` privacy stance

The existing table stores raw meal input and full `userContextJson`. The clean §5 privacy story is false until this is addressed. Three options, ordered by my preference:

1. **Split debug-from-analytics retention.** Keep `pipeline_requests` for short-window operational debugging (7-day TTL, restricted access). New `pipeline_runs` is the analytics/eval source. Documented access controls. *Preferred — preserves debuggability with explicit TTL.*
2. **Scrub raw_input.** Drop the column or store a hash-or-category. Lose ability to reproduce production bugs from raw input. *Cleanest privacy, worst debuggability.*
3. **Keep status quo, document the leak in this spec.** *Honest but unsatisfying — goes against the privacy claim of §5.*

### Open Decision B — `addedFat` modeling

When LLM detects "stir-fried with added oil" or "drizzled with sauce" not represented by any matched ingredient, should the value:

1. Live as a separate `addedFat: { grams, reason }` field on `MatchedIngredientFactors`. *Most honest; explicit; queryable retirement metric.*
2. Be folded into `nutrientFactor.fat` and `nutrientFactor.kcal` as a multiplier > 1. *Simpler schema; loses the "added" signal.*
3. Be split into a synthetic unmatched ingredient ("added cooking oil"). *Cleanest separation; complicates streaming display.*

I lean (1).

### Open Decision C — Shadow A/B sampling rate

Default 5% of traffic. With the rubber-duck's #9 isolation requirements, even 5% can be bursty. Options: 1%, 5%, dynamic (autoscale based on primary p95).

I lean static 5% with abort-on-degradation as the safety valve, simplest to reason about.

---

## 6. Rollout Sequencing

Each phase ships independently and is reversible. Telemetry must accompany each phase.

| Phase | Content | Risk | Reversibility |
|---|---|---|---|
| **1. §0 Foundations** | Stable IDs, state propagation, prompt/schema versioning, `pipeline_runs` table, Decision A resolution | Low — behavior-neutral plumbing | Drop migration, revert code |
| **2. §3 Type-safe prompts** | `PromptPersonalizationContext` type, prompt rewrite at `nutrition.ts:138-144`, sentinel tests | Low — prompt change behind versioning, observable via telemetry | Revert; old prompt version still queryable |
| **3. §5.2 Shadow runner** | Off-by-default infrastructure, abort guards, paired-output store | Low — disabled by default | Feature flag off |
| **4. §1 Factor schema** | Three-factor split, discriminated union, runtime arithmetic, envelope-as-anomaly | Medium — semantic change to nutrition | Ship behind shadow first; flag-flip rollback |
| **5. §4 Model upgrade + cache + policy** | New default model, escalation routing, L4 cache, narrow `MealFactsForComputePolicy` | Medium — distributional shift | Constants flip back; cache flushable |
| **6. §2 Dish-wrapped decomposition** | New schema, `canonicalName`, source/state tie-breakers, `expectedState` per ingredient | Medium — schema change with prompt rewrite | Schema version flips; rollback path through versioning |
| **7. §2.4 RRF measurement → maybe RRF** | Phase A logging only; Phase B feature-flagged ship-or-no-ship decision | Low (phase A) / Medium (phase B) | Flag controlled |

§4's model upgrade may be **bundled with §1** if shadow A/B shows them stable together. They can also ship independently.

---

## 7. Tech-Debt Safeguards

These exist to prevent the design from rotting.

- **Hard enums only where DB enforces closed sets.** Cuisine/cooking-method/cuisineNote stay free-form. Adding a closed enum requires a corresponding DB constraint or it doesn't ship.
- **Validation rejects zero-information overrides.** If decomposition emits `sourceOverride` equal to dish `sourcePrior`, treat it as decomposition noise (telemetry, ignore).
- **`canonicalName` is validated against FCT vocabulary.** Misses become an alias-retirement signal, not invisible failures.
- **No silent clamps.** Out-of-envelope factors, unknown DB states, validation breaches are all telemetry events.
- **Telemetry is structured at the source.** No deriving critical fields from log-string parsing. The `pipeline_runs` schema is the contract.
- **Pure routing function with narrow input type.** `pickComputePolicy(MealFactsForComputePolicy)` cannot drift into receiving `UserContext`.
- **Cache keys include `*Version` constants.** Bumping the constant invalidates the cache — no manual flush ritual.
- **Aggregate-not-per-user telemetry.** Every metric is system-level. No per-user behavioral inference.

---

## 8. Success Indicators

Honest, observable signals — not aspirational metrics.

- **Correctness.** `factor_envelope_fires` rate stable and < 2% of meals after week 4. `db_state_unknown_fires` stable and < 5% (most rows have known state). `macro_inconsistent` anomaly rate < 1%.
- **Performance.** End-to-end p95 not worse than today after §1 + §4 ship. Shadow divergence on macro totals < 30% in 95% of paired runs.
- **Tech-debt retirement.** `pre_match_alias_hits` declining quarterly as the LLM internalizes vocabulary. `cooked_to_raw_factor_fires` reaches < 5% (gate for retirement).
- **Principle adherence.** Sentinel tests pass forever. `prompt_personalization_fields` telemetry never includes `goal` or `aggression`.
- **Shadow A/B utility.** When a future change ships, divergence query yields actionable signal (real misses, not noise).

What we don't promise: a target accuracy number. Nutrition has fuzzy ground truth; promising a number invites Goodharting.

---

## 9. Implementation Plan Reference

A detailed implementation plan with file-level changes will be produced via the `writing-plans` skill once this spec is approved.

---

## 10. References

- `lib/ai/pipeline/orchestrator.ts` — central pipeline; touched by §0–§4
- `lib/ai/pipeline/schemas.ts` — discriminated union (§1), dish-wrapped decomposition (§2)
- `lib/ai/pipeline/validation.ts` — anomaly thresholds; envelope-as-anomaly (§1.4)
- `lib/ai/pipeline/assembly.ts` — runtime arithmetic (§1.2), state-branched scaling (§0.2)
- `lib/ai/pipeline/goal-adjustment.ts` — the deterministic preference layer (Principle A)
- `lib/ai/prompts/decomposition.ts`, `lib/ai/prompts/nutrition.ts` — §3 rewrite
- `lib/ai/matching/cascade.ts`, `lib/ai/matching/source-matching.ts`, `lib/ai/matching/aliases.ts` — §2
- `lib/ai/constants.ts` — `COOKED_TO_RAW_FACTOR` retirement (§1.5)
- `lib/db/schema.ts` — DB constraints (`state`, `source_id` FK)
- `lib/ai/types.ts` — `UserContext`; `PromptPersonalizationContext` derives via `Pick`
- `supabase/migrations/20260406033451_add_pipeline_requests_table.sql` — Open Decision A target
