# AI Pipeline V2 — Critical Optimization Design

**Date**: 2026-03-31
**Status**: Approved
**Scope**: Latency reduction, USDA data enrichment, anti-hallucination, token efficiency, observability

---

## Problem Statement

The meal analysis pipeline currently takes 15-30s per request with unpredictable latency variance. The ingredient database (VTN FCT 2007, 526 items) lacks granularity for common ingredients (e.g., no separate chicken breast vs thigh). Token usage is unoptimized for future paid-tier costs. Hallucination (invented ingredients, implausible weights) is not systematically detected or prevented.

## Target Outcomes

| Metric | Current | Target |
|--------|---------|--------|
| Latency (p50) | ~15-20s | 5-8s |
| Latency (p95) | ~30s | <12s |
| Ingredient DB coverage | 526 items (FAO only) | ~1,500-2,000 items (FAO + USDA) |
| Input tokens per request | ~16-19K | ~8-10K |
| Hallucination detection | None | Post-parse validation layer |
| Observability | Console logs | Structured per-stage metrics |

## Approach: "Compress + Overlap + Enrich"

Keep the proven 2-LLM-call architecture. Optimize latency through prompt compression, streaming/overlap, and batch operations. Enrich data with USDA. Add hallucination guardrails and observability.

---

## Section 1: Pipeline Architecture — Latency Optimization

### 1.1 Current Flow (Sequential, 15-30s)

```
LLM Call 1 — Decomposition (7.5K tokens, 1-5s)
  → wait →
Ingredient Matching (3-8s, serial embedding lookups)
  → wait →
LLM Call 2 — Nutrition (10K tokens, 2-8s)
  → wait →
Assembly (~100ms)
```

### 1.2 Redesigned Flow (Overlapped, 5-8s)

```
LLM Call 1 [STREAMING] (3-4K tokens, 1-3s)
  ↓ ingredients stream out as generated
  ↓ start matching each ingredient AS IT APPEARS
Ingredient Matching [PARALLEL with streaming] (1-2s overlapped)
  ↓ batch embedding call (1 API call for all L3 misses)
  ↓ all DB lookups fire concurrently (3-worker pool)
LLM Call 2 (5-6K tokens, 1.5-3s)
  ↓
Assembly (~100ms)
```

### 1.3 Specific Changes

#### 1.3a Prompt Compression

**Decomposition prompt: 7,500 → ~3,500 tokens**
- Consolidate 4 worked examples into 2 most diverse (simple meal + complex multi-item meal)
- Remove verbose preamble and redundant restatements
- Merge overlapping rules (ingredient_naming_rule + strict_adherence_rule)
- Use terse instruction style without sacrificing critical rules
- Preserve all critical rules: gram_weight_rule, ingredient_naming_rule, cooking_method_rule, strict_adherence_rule
- Keep all XML tags — compress content within them

**Nutrition prompt: ~10,000 → ~5,500 tokens**
- Same compression approach for instruction section
- Keep XML data sections verbatim (dynamic, can't compress)
- Replace prose cooking adjustment descriptions with concise reference table
- Keep XML format for ingredient data (opening/closing tags aid LLM parsing)

#### 1.3b Streaming Decomposition + Speculative Matching

- Use Gemini streaming API for Call 1
- Parse partial JSON as ingredients appear in the stream
- Fire off matching (embedding lookup + DB search) for each ingredient before full response completes
- Matching now overlaps with generation instead of waiting for full decomposition
- Expected savings: 2-5s

#### 1.3c Batch Embedding API Calls

- Current: N separate `generateEmbedding()` calls per meal (1 per ingredient on L3 cache miss)
- New: Collect all L3 misses after L1/L2 cache checks, make 1 batch call to Gemini embedding API
- Gemini supports batch embedding (up to 100 texts per call)
- Savings: (N-1) × API round-trip time (~400ms each)

#### 1.3d Remove `thinkingLevel: 'low'`

- Currently enabled for **both** LLM calls (decomposition AND nutrition) in `orchestrator.ts`
- Extended thinking adds ~200-500ms latency per call for internal reasoning chain
- Both calls are structured extraction tasks that don't benefit from explicit thinking
- Action: Remove `thinkingConfig` parameter from **both** Call 1 and Call 2

#### 1.3e Explicit Context Caching (Future, Paid Tier)

- Cache static system prompt portions via Gemini caching API
- Deploy when moving to paid tier
- Implicit caching already active for free since May 2025
- Minimum token requirement: 1024 tokens (both prompts qualify at 3.5K+ and 5.5K+)
- Expected cost impact: ~4x reduction on cached tokens

### 1.4 What Stays the Same

- 2 LLM calls (decomposition + nutrition) — sequential dependency preserved
- Matching cascade (pgvector → pg_trgm) — proven architecture
- 3-worker concurrency limit — protects Supabase connection pool
- Re-ranking logic (boost-only) — working well
- Assembly + goal adjustment — deterministic, already fast (~100ms)

---

## Section 2: USDA Data Enrichment Pipeline

### 2.1 Data Source

**USDA FoodData Central — SR Legacy (Standard Reference)**
- ~7,700 foods with comprehensive nutrient profiles
- Well-structured, downloadable as CSV/JSON
- Public domain, no licensing issues
- Granular protein cuts (chicken breast, thigh, wing, drumstick)
- Foreign foods well-represented (pasta varieties, cheese types, bread)

### 2.2 Enrichment Strategy: Fill the Gaps

**Step 1: Identify gaps in VTN FCT 2007**
- Query `unmatched_ingredients` log for common user queries that miss
- Cross-reference with VTN FCT 2007's 526 items
- Common gap categories: protein cuts, foreign foods, processed foods, specific produce varieties

**Step 2: Curate a USDA subset (~800-1,500 items)**

| Category | Est. Items | Examples |
|----------|-----------|----------|
| Protein cuts (poultry, pork, beef, seafood) | ~200 | chicken breast, pork loin, shrimp |
| Grains & starches | ~100 | pasta varieties, bread types, noodles |
| Dairy & eggs | ~80 | cheese types, milk, yogurt |
| Vegetables & fruits | ~150 | items missing from VTN |
| Processed/packaged foods | ~100 | instant noodles, sausage |
| Oils, sauces, condiments | ~50 | olive oil, soy sauce varieties |
| Beverages | ~50 | juices, milk alternatives |
| Nuts, seeds, legumes | ~70 | almonds, chia, lentils |

**Step 3: Nutrient mapping**
- Map USDA nutrients → existing 28-nutrient schema
- Handle unit conversions (USDA mg, µg, IU → project standard units)
- USDA has more nutrients than our schema — extract only the 28 we track

**Step 4: Import into `vietnamese_food_composition` table**
- Create new `ingredient_sources` reference table: `{ id, name }` with values 'FAO' and 'USDA'
- Replace existing text `source` column in `vietnamese_food_composition` with FK to `ingredient_sources.id`
  - Requires editing `lib/db/schema.ts` → `bun db:generate` → data migration (convert existing 'FAO_VN_2007' rows → FK)
- Generate embeddings via existing batch backfill script

**Step 5: Translation pipeline (separate phase)**
- USDA names are English → need Vietnamese `name_primary`
- Extend existing `backfill-translations.ts` pattern
- Priority order: protein cuts → foreign foods → processed items

### 2.3 Source Priority Logic

When matching an ingredient, if both FAO and USDA have entries:
- **Prefer FAO** for Vietnamese-specific items (gạo tẻ, nước mắm, etc.)
- **Prefer USDA** when FAO is too coarse (chicken breast vs generic chicken)
- Natural similarity scoring handles most cases — FAO Vietnamese names will naturally score higher for Vietnamese queries
- Optional: +0.05 boost for FAO source in re-ranking if needed

### 2.4 Storage Budget

| State | Items | Embeddings | Est. Size |
|-------|-------|-----------|-----------|
| Current (FAO only) | 526 | 768-dim | ~3MB |
| After USDA | ~2,000 | 768-dim | ~12MB |
| Supabase free tier | — | — | 500MB |

Well within limits. ✅

### 2.5 Deliverables

- Python script: `scripts/usda/import_usda_sr.py` — download, filter, map, export
- Migration: Insert USDA entries into `vietnamese_food_composition`
- Backfill: Generate embeddings for new entries
- Translation: Vietnamese names for USDA items (separate phase)

---

## Section 3: Anti-Hallucination & Accuracy Improvements

### 3.1 Temperature Reduction

| Call | Current | New | Rationale |
|------|---------|-----|-----------|
| Decomposition (Call 1) | 1.0 | 0.3 | Extraction is deterministic — lower temp = fewer invented ingredients |
| Nutrition (Call 2) | 1.0 | 0.5 | Needs some variance for meaningful bounded estimates (low ≠ mid ≠ high) |

Keep `topK: 1` (greedy decoding for top token) — currently set on Call 1, add to Call 2 as well for consistency.

### 3.2 Output Validation Layer (Post-Parse Sanity Checks)

Applied after LLM returns, before assembly. Flag anomalies (log for analysis, don't silently fix).

**Calorie density checks:**
- No ingredient > 900 kcal/100g (pure fat ≈ 884)
- No meal item > 1,500 kcal (unless explicitly large portion)

**Weight consistency checks:**
- Total ingredient weights should be plausible for the described meal
- Individual ingredients in plausible range (e.g., oil 5-30g, not 500g)

**DB-anchor deviation check (matched ingredients only):**
- Compare LLM macro estimates vs DB-scaled values
- If deviation > 50% → flag as potential hallucination
- Log for prompt tuning (don't auto-correct — LLM may have valid cooking reasoning)

### 3.3 Prompt Hardening

**Negative examples in decomposition prompt:**
- ❌ "thịt kho" → do NOT add trứng (that would be "thịt kho trứng")
- ❌ "canh" → do NOT guess vegetables
- ❌ Do NOT add ingredients not mentioned or necessarily implied

**Confidence calibration instruction:**
- "If uncertain about a weight, widen the LOW-HIGH range rather than guessing a precise MID"

**Output format examples:**
- Show correct bounded estimate patterns in the nutrition prompt

### 3.4 Ingredient Name Standardization (Post-LLM Alias Map)

Common alias map applied after decomposition, before matching:
```ts
const INGREDIENT_ALIASES: Record<string, string> = {
  'cơm': 'gạo tẻ',
  'ba chỉ': 'thịt lợn ba chỉ',
  'trứng': 'trứng gà',
  'đậu': 'đậu phụ',
  'tôm': 'tôm sú',
  // ... expand over time based on unmatched_ingredients log
};
```

Applied after LLM decomposition, before ingredient matching. Improves DB match rate without relying on LLM to always use canonical names.

---

## Section 4: Token Efficiency & Cost Optimization

### 4.1 Prompt Compression Strategy

See Section 1.3a for full details. Summary:
- Decomposition: 7,500 → ~3,500 tokens (2 examples, terse rules)
- Nutrition: ~10,000 → ~5,500 tokens (compressed instructions, keep XML data)
- Per-request savings: ~8,000 input tokens

### 4.2 Dynamic Prompt Assembly

Conditional template sections:
- Skip rice-specific rules when no rice in meal
- Skip soup/broth rules when no soup detected
- Skip regional priors when user hasn't set region
- Implementation: Template system with conditional section inclusion
- Savings: ~500-1,000 tokens for simple meals

### 4.3 Gemini Context Caching (Paid Tier Prep)

- Cache static prompt portions on server startup
- Static: ~80% of each prompt (rules, examples, cooking tables)
- Dynamic: ~20% (user context, matched ingredient data)
- Expected cost impact: ~60% reduction on input tokens
- Implementation: Gemini `cachedContents` API

### 4.4 Micronutrient Strategy

- LLM estimates 4 macros only (no change — already token-efficient)
- 24 micronutrients scaled from DB: `micro = (grams / 100) × dbPer100g`
- No LLM involvement for micros — zero additional tokens
- Store scaled micros per-meal-item in DB for future premium features (daily RDA tracking, deficiency alerts)
- Note: `meal_items` table already has all 28 micro JSONB columns in schema — only the population logic during pipeline assembly needs to be wired up

---

## Section 5: Observability & Error Handling

### 5.1 Structured Pipeline Logging

```
[pipeline] START meal_id=abc123
[pipeline] decomposition: 1,823ms | tokens_in=3,400 tokens_out=280 | items=3 ingredients=7
[pipeline] matching: 1,102ms | matched=5 unmatched=2 | cache_hits=3 cache_misses=4 batch_embed=1
[pipeline] nutrition: 2,341ms | tokens_in=5,200 tokens_out=450
[pipeline] assembly: 12ms
[pipeline] DONE meal_id=abc123 | total=5,278ms | confidence=medium
```

**Key metrics per request:**
- Per-stage latency breakdown
- Token counts per LLM call (input + output)
- Cache hit rates (embedding L1/L2/L3)
- Match rates (matched vs unmatched count)
- Confidence distribution

### 5.2 Anomaly Detection (Lightweight)

Flags logged for monitoring, don't block the response:
- Total calories < 50 or > 3,000 (likely error)
- Individual ingredient > 500g (likely misparse)
- > 50% ingredients unmatched (likely poor DB coverage)

### 5.3 Error Recovery Improvements

- Keep: 1 automatic retry on parse error (existing behavior)
- Add: Retry once if Call 2 returns implausible nutrition (0 calories for a real meal) with "please recalculate" appended
- Add: Timeout handling — if Gemini doesn't respond in 15s per call, abort and return user-friendly error

---

## Implementation Priority

All items ship as part of a single pipeline V2 upgrade:

1. **Prompt compression** (1a) — highest-impact, lowest-risk
2. **Temperature reduction** (3a) — trivial change, immediate hallucination benefit
3. **Remove thinkingLevel** (1d) — trivial change, immediate latency win
4. **Batch embedding calls** (1c) — moderate complexity, good latency win
5. **Output validation layer** (3b) — new code, no pipeline changes
6. **Ingredient alias map** (3d) — new code, easy to maintain
7. **Structured logging** (5a) — replace existing logs
8. **Streaming decomposition + speculative matching** (1b) — highest complexity, biggest latency win
9. **Dynamic prompt assembly** (4b) — moderate complexity
10. **Anomaly detection** (5b) — lightweight addition
11. **Error recovery improvements** (5c) — timeout + retry logic
12. **USDA data import** (Section 2) — separate workstream, independent of pipeline code
13. **Context caching prep** (4c) — future, deferred until paid tier

---

## Files to Create/Modify

### New Files
- `scripts/usda/import_usda_sr.py` — USDA data download, filter, map, export
- `scripts/usda/README.md` — USDA import documentation
- `lib/ai/validation.ts` — Post-parse sanity checks, anomaly detection
- `lib/ai/aliases.ts` — Ingredient name alias map

### Modified Files
- `lib/db/schema.ts` — Add `ingredient_sources` table, replace text `source` column with FK
- `lib/ai/prompts/decomposition.ts` — Compressed prompt (~3,500 tokens)
- `lib/ai/prompts/nutrition.ts` — Compressed prompt (~5,500 tokens)
- `lib/ai/pipeline/orchestrator.ts` — Streaming, timeout, structured logging
- `lib/ai/matching/cascade.ts` — Batch embedding support
- `lib/ai/matching/embedding-cache.ts` — Batch resolve support
- `lib/ai/matching/index.ts` — Speculative matching integration
- `lib/ai/gemini.ts` — Streaming API, batch embedding, context caching prep
- `lib/ai/constants.ts` — Alias map import, validation thresholds
- `lib/ai/pipeline/assembly.ts` — Micro storage prep, validation integration
- `lib/ai/pipeline/errors.ts` — Timeout error handling

### Test Files
- `lib/ai/__tests__/validation.test.ts` — Sanity check tests
- `lib/ai/__tests__/aliases.test.ts` — Alias map tests
- `lib/ai/__tests__/pipeline.test.ts` — Updated for V2 flow
- `lib/ai/__tests__/gemini.test.ts` — Streaming + batch embedding tests

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Compressed prompts degrade LLM accuracy | Medium | High | A/B test compressed vs original; measure match rates |
| Streaming JSON parsing fragility | Medium | Medium | Robust incremental JSON parser; fallback to non-streaming |
| USDA data quality issues | Low | Medium | Validation pipeline before import; manual spot-checks |
| Temperature reduction makes bounds too narrow | Low | Medium | Monitor bound widths; adjust if LOW ≈ MID ≈ HIGH |
| Batch embedding API behavior differs from single | Low | Low | Test with real API; fallback to individual calls |
