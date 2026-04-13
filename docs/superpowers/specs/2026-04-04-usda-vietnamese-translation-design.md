# USDA Vietnamese Translation Pipeline

**Date**: 2026-04-04
**Status**: Draft
**Author**: AI-assisted design

## Problem

The database contains 7,471 food composition items from two sources:

- **FAO (526 items)**: Vietnamese `name_primary`, good Vietnamese search coverage
- **USDA (6,945 items)**: English-only `name_primary` (= `name_en`), invisible to Vietnamese search

Vietnamese users searching for "ức gà" (chicken breast) get matched to FAO's "thịt gà ta" (generic chicken) instead of USDA's precise "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw" — which has the exact nutrient data they need.

### Root Cause

Two matching tiers both fail for Vietnamese → USDA:

1. **Trigram search (pg_trgm)**: Zero character overlap between Vietnamese queries and English names. "ức gà" vs "Chicken breast" → similarity 0.06.
2. **Vector search (pgvector)**: Cross-language embedding gap of ~0.05–0.08 cosine distance. USDA items rank #2–#10 but always behind FAO equivalents.

### Measured Impact

| Vietnamese Query | Expected Match | Actual Match | Problem |
|---|---|---|---|
| ức gà (chicken breast) | USDA chicken breast | FAO gan gà (liver) | Wrong organ |
| ba chỉ (pork belly) | USDA pork belly | FAO chân giò lợn (trotter) | Wrong cut |
| cá hồi (salmon) | USDA salmon fillet | FAO cá hồi (generic) | Less precise |
| bông cải xanh (broccoli) | USDA broccoli | FAO súp lơ xanh | Less precise |

### Why Translation API Alone Is Insufficient

Google Translate produces mechanical translations that miss Vietnamese cooking language:

- `"Chicken, leg, meat only, raw"` → `"Gà, chân, chỉ thịt, sống"`
- Vietnamese users search: `"đùi gà bỏ da bỏ mỡ"` — not a translation, a cultural equivalent

The USDA modifier vocabulary ("meat only", "skinless, boneless", "separable lean and fat") maps to Vietnamese preparation terms ("bỏ da bỏ mỡ", "không da không xương", "nạc và mỡ") that Translation API cannot generate.

## Solution

Hybrid pipeline splitting work by what each tool does well:

1. **Translation API → `name_primary`**: Mechanical, deterministic translation of `name_en`. Gets Vietnamese base terms ("gà", "thịt bò", "cá hồi") into the search text.
2. **Gemini Flash LLM → `name_alt[]`**: Generate 2–4 Vietnamese cooking-language phrase variants per item. Maps USDA taxonomy to Vietnamese preparation modifiers.
3. **DB Update**: Write both fields; `build_food_search_text()` trigger auto-rebuilds `search_text` and `search_text_ascii`.
4. **Re-embed**: Regenerate embeddings from updated `search_text` (now multilingual).

### Scope

13 USDA categories (~4,746 items):

| Category | Items | Notes |
|---|---|---|
| Beef Products | 954 | ~200 unique base foods, many fat trim/grade variants |
| Vegetables and Vegetable Products | 812 | Broad overlap with Vietnamese cooking |
| Lamb, Veal, and Game Products | 464 | Goat is used in Vietnamese cuisine |
| Poultry Products | 383 | Essential — gà, vịt |
| Fruits and Fruit Juices | 355 | Tropical fruits |
| Pork Products | 336 | #1 protein in Vietnamese diet |
| Dairy and Egg Products | 291 | Mainly eggs, milk, yogurt |
| Legumes and Legume Products | 290 | Tofu, beans, lentils |
| Finfish and Shellfish Products | 264 | Essential — cá, tôm |
| Fats and Oils | 216 | Cooking oils, lard |
| Cereal Grains and Pasta | 181 | Rice, noodles, flour |
| Nut and Seed Products | 137 | Sesame, peanut, coconut |
| Spices and Herbs | 63 | Common overlap |

**Excluded (2,197 items)**: Beverages (branded), Breakfast Cereals (branded), Baked Products (US context), Sweets (branded), Soups/Sauces (branded), Sausages/Luncheon (US deli), Other (Alaska Native, mixed).

## Architecture

### Pipeline Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Phase 1:       │     │  Phase 2:        │     │  Phase 3:    │     │  Phase 4:   │
│  Google         │────▶│  Gemini Flash    │────▶│  DB Update   │────▶│  Re-embed   │
│  Translate API  │     │  LLM             │     │              │     │             │
│                 │     │                  │     │  name_primary │     │  search_text│
│  name_en →      │     │  name_en +       │     │  name_alt    │     │  → embedding│
│  Vietnamese     │     │  type_en →       │     │  (trigger    │     │  (768 dims) │
│  name_primary   │     │  name_alt[]      │     │   rebuilds   │     │             │
│                 │     │  variants        │     │   search_    │     │             │
│                 │     │                  │     │   text)       │     │             │
└─────────────────┘     └──────────────────┘     └──────────────┘     └─────────────┘
        │                        │                       │                     │
        ▼                        ▼                       │                     │
   checkpoint-1.json       checkpoint-2.json             │                     │
   (translation results)   (name_alt results)            │                     │
                                                         ▼                     ▼
                                                    DB updated            Embeddings
                                                    (atomic per           regenerated
                                                     category)
```

### Data Model Changes

No schema changes required. All columns already exist:

```typescript
// lib/db/schema.ts — vietnameseFoodComposition table
namePrimary: text('name_primary').notNull(),  // Currently: English for USDA → will be Vietnamese
nameEn: text('name_en').notNull(),            // Unchanged — always English
nameAlt: text('name_alt').array(),            // Currently: null for USDA → will be Vietnamese variants
searchText: text('search_text'),              // Auto-rebuilt by trigger
searchTextAscii: text('search_text_ascii'),   // Auto-rebuilt by trigger
embedding: vector('embedding', { dimensions: 768 }),  // Regenerated from new search_text
```

**Before** (USDA chicken breast):
```text
name_primary: "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
name_en:      "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
name_alt:     null
search_text:  "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
              (name appears twice — trigger concatenates name_primary + name_en)
```

**After**:
```text
name_primary: "Gà, gà thịt hoặc gà rán, ức, không da, không xương, chỉ thịt, sống"
name_en:      "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
name_alt:     ["ức gà không da không xương", "ức gà bỏ da", "ức gà phi lê"]
search_text:  "Gà, gà thịt hoặc gà rán, ức, không da, không xương, chỉ thịt, sống ức gà không da không xương ức gà bỏ da ức gà phi lê Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
```

### Embedding Text Construction

The backfill script constructs embedding input as:

```typescript
function buildEmbeddingText(row): string {
  const alt = row.nameAlt?.length ? ` ${row.nameAlt.join(' ')}` : '';
  return `${row.namePrimary}${alt} ${row.nameEn} ${row.typeVn} ${row.typeEn}`;
}
```

After translation, this becomes multilingual:
```text
"Gà, ức, không da, sống ức gà không da không xương ức gà bỏ da ức gà phi lê Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw Gia cầm Poultry Products"
```

This is intentional — the embedding captures both Vietnamese and English terms, allowing queries in either language to match.

## Phase Details

### Phase 1: Google Cloud Translation API

**API**: Google Cloud Translation v2 (Basic)
**Authentication**: API key via `GOOGLE_TRANSLATE_API_KEY` environment variable
**Endpoint**: `POST https://translation.googleapis.com/language/translate/v2`

**Batching**:
- v2 accepts up to 128 strings per request
- 4,746 items ÷ 128 = ~37 API calls
- Sequential with 100ms delay between calls

**Cost**:
- Average `name_en` length: ~80 characters
- Total: 4,746 × 80 = ~380,000 characters
- Free tier: 500,000 characters/month → fits within free tier

**Input/Output**:
```text
Input:  "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"
Output: "Gà, gà thịt hoặc gà rán, ức, không da, không xương, chỉ thịt, sống"
```

**Error handling**:
- Retry on 429/5xx with exponential backoff (3 attempts)
- Save all successful translations to `checkpoint-1.json` incrementally
- On resume: skip items already in checkpoint

### Phase 2: Gemini Flash LLM (name_alt Generation)

**Model**: `gemini-3-flash-preview` (free tier: 15 RPM/key × up to 10 keys = 150 RPM max)
**Batching**: By category, ~25 items per prompt (may drop to ~20 for categories with long names like Beef)
**Estimated calls**: ~190–240 prompts → ~1–2 minutes at full 10-key rotation (effective throughput limited by cooldowns)

**System Prompt** (abbreviated):

```text
You are a Vietnamese food naming expert. Given USDA food composition entries,
generate 2-4 Vietnamese alternative names (name_alt) that Vietnamese home cooks
would actually use when describing this food.

USDA Modifier → Vietnamese Cooking Language:
- "meat only" → "bỏ da bỏ mỡ" or "chỉ thịt nạc"
- "skinless, boneless" → "không da không xương" or "lọc xương bỏ da"
- "separable lean only" → "phần nạc" or "chỉ nạc"
- "separable lean and fat" → "nạc và mỡ" or "cả nạc lẫn mỡ"
- "trimmed to 0" fat" → "cắt bỏ mỡ" or "bỏ hết mỡ"
- "raw" → (omit — Vietnamese rarely specifies this)
- "cooked, braised" → "kho" or "hầm"
- "cooked, grilled" → "nướng"
- "cooked, roasted" → "quay"

Examples from existing FAO Vietnamese entries:
- "Thịt gà ta" → name_alt: ["gà ta", "gà thả vườn"]
- "Thịt lợn nạc" → name_alt: ["thịt heo nạc", "nạc heo", "nạc lợn"]
- "Cá hồi" → name_alt: ["cá hồi tươi", "phi lê cá hồi"]

Rules:
- Start each variant with the Vietnamese food name (e.g., "ức gà", "ba chỉ", "cá hồi")
- Include preparation modifiers that match the USDA entry's state
- Use BOTH Northern (lợn) and Southern (heo) Vietnamese terms where applicable
- Keep variants short (2-5 words each)
- Do NOT include cooking methods unless the USDA entry specifies a cooked state
- Output valid JSON only
```

**Input** (per prompt, batched by category):
```json
{
  "category": "Poultry Products",
  "items": [
    {"fdc_id": "1234", "name_en": "Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw"},
    {"fdc_id": "1235", "name_en": "Chicken, broilers or fryers, thigh, meat only, cooked, roasted"},
    ...
  ]
}
```

**Output** (structured JSON):
```json
[
  {"fdc_id": "1234", "name_alt": ["ức gà không da không xương", "ức gà bỏ da", "ức gà phi lê"]},
  {"fdc_id": "1235", "name_alt": ["đùi gà quay bỏ da", "đùi gà nướng bỏ mỡ"]}
]
```

**Validation**:
- Parse JSON response; retry on parse failure (max 2 retries)
- Verify each `fdc_id` in response matches input
- Verify `name_alt` is a non-empty array of strings
- Log warnings for items with < 2 or > 4 variants
- Save results to `checkpoint-2.json` incrementally (per category)

### Phase 3: Database Update

**Strategy**: Update per category in a transaction.

```sql
-- For each item in the category:
UPDATE vietnamese_food_composition
SET name_primary = $1,
    name_alt = $2
WHERE id = $3;
-- Trigger auto-rebuilds search_text and search_text_ascii
```

**Order**: Process categories sequentially. Each category is committed independently — if the script fails after completing Beef, Beef stays translated.

**Verification**: After each category update, query one item to confirm `search_text` was rebuilt correctly.

### Phase 4: Re-embedding

**Method**: Reuse `buildEmbeddingText()` logic from `scripts/backfill_embeddings.ts`.
**Model**: `gemini-embedding-001` (768 dimensions)
**API**: `batchEmbedContents` — 50 items per batch → 95 calls
**Rate limit**: Free tier counts each text in a batch as 1 request toward 100 req/min limit. 50 texts/batch = 50 requests.
**Delay**: 35s between batches (proven in existing `backfill_embeddings.ts` — matches 100 req/min free tier)

**Embedding input** (multilingual, from `buildEmbeddingText`):
```text
{namePrimary} {nameAlt joined by space} {nameEn} {typeVn} {typeEn}
```

This produces a multilingual embedding that responds to both Vietnamese and English queries.

## Error Handling & Recovery

### Checkpoint Files

The script writes JSON checkpoint files to `data/translation-checkpoints/`:

- `checkpoint-1.json`: `{ [id]: { name_primary_vi: string } }`
- `checkpoint-2.json`: `{ [id]: { name_alt: string[] } }`

On resume, the script reads existing checkpoints and skips completed items.

### Failure Modes

| Failure | Impact | Recovery |
|---|---|---|
| Translation API quota exceeded | Phase 1 stalls | Resume next day (checkpoint preserved) |
| Translation API 5xx | Temporary | Retry with exponential backoff |
| Gemini Flash rate limit | Phase 2 slows | Built-in delay respects 15 RPM |
| Gemini Flash parse failure | Item skipped | Retry prompt (max 2); log if still failing |
| DB update failure | Category rolled back | Re-run category from checkpoint data |
| Embedding quota exceeded | Phase 4 stalls | Resume next day |

### Rollback

If translation quality is unacceptable:

```sql
-- Reset USDA items to English-only state
UPDATE vietnamese_food_composition
SET name_primary = name_en,
    name_alt = NULL
WHERE source_id = 2  -- USDA_SR in ingredient_sources
  AND type_en = ANY($1);  -- specify categories
-- Trigger rebuilds search_text automatically
-- Then re-run embedding backfill
```

## Validation

### Automated Test Suite

After the pipeline completes, run 10 Vietnamese queries through the matching cascade and verify USDA items appear in results:

| Query | Expected: USDA item in top 5 | Pre-translation baseline |
|---|---|---|
| ức gà | Chicken breast (USDA) | ❌ FAO only |
| đùi gà bỏ da | Chicken thigh, meat only (USDA) | ❌ FAO only |
| ba chỉ heo | Pork belly (USDA) | ❌ FAO only |
| cá hồi phi lê | Salmon fillet (USDA) | ❌ FAO only |
| bông cải xanh | Broccoli (USDA) | ❌ FAO only |
| thịt bò nạc | Beef, lean (USDA) | ❌ FAO only |
| tôm sú | Shrimp (USDA) | ❌ FAO only |
| đậu phụ | Tofu (USDA) | ❌ FAO only |
| gạo tẻ | Rice, white (USDA) | ❌ FAO only |
| dầu mè | Sesame oil (USDA) | ❌ FAO only |

**Success criteria**: ≥ 8 of 10 queries return at least one USDA item in top 5 results.

### Manual Spot Check

Sample 5 items per category, review:
- `name_primary` is reasonable Vietnamese (not gibberish)
- `name_alt` variants use Vietnamese cooking language
- `search_text` contains both Vietnamese and English terms
- Embedding cosine similarity with Vietnamese query ≥ 0.7

## Script Location & Usage

**File**: `scripts/translate-usda-vietnamese/index.ts`

**Environment variables required**:
- `GOOGLE_TRANSLATE_API_KEY` — Google Cloud Translation API key (Phase 1)
- `GEMINI_API_KEY_1..10` — 10 Gemini API keys from different GCP projects (Phase 2 & 4)
- `DATABASE_URL` — Supabase connection string (existing)

**Usage**:
```bash
bun --env-file=.env.local scripts/translate-usda-vietnamese/index.ts
```

**Flags** (optional):
- `--phase=1|2|3|4` — Run a specific phase only (for debugging/recovery)
- `--category="Beef Products"` — Process a single category only
- `--dry-run` — Print what would be translated without writing to DB
- `--resume` — Resume from checkpoint files

## Cost & Time Estimates

| Phase | API | Calls | Cost | Time |
|---|---|---|---|---|
| Translation | Google Translate v2 | ~37 | Free (380k chars < 500k limit) | ~30 seconds |
| name_alt LLM | Gemini Flash | ~190–240 | Free (15 RPM tier) | ~13–16 minutes |
| DB Update | — | 4,746 UPDATEs | — | ~2 minutes |
| Re-embedding | Gemini Embedding | ~95 batches (35s gap) | Free (< 1,000 req/day) | ~55 minutes |
| **Total** | | | **$0** | **~70–75 minutes** |

## Open Questions

1. **Northern vs Southern Vietnamese**: Should `name_alt` always include both "lợn" (Northern) and "heo" (Southern) variants for pork items? Current design says yes — doubles pork-related variants but serves both dialect groups.

2. **Cooked state items**: USDA has many "cooked, braised/grilled/roasted" variants. Should `name_alt` include the Vietnamese cooking method ("kho", "nướng", "quay")? Current design includes cooking methods only when the USDA entry specifies a cooked state.

3. **Google Cloud Translation API key**: The project currently only has `GEMINI_API_KEY`. A `GOOGLE_TRANSLATE_API_KEY` needs to be provisioned. Alternative: use Gemini Flash for Phase 1 too (translate in addition to name_alt), eliminating the extra API key dependency. Trade-off: less deterministic but fewer moving parts.
