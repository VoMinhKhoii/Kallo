# INGREDIENT MATCHING PIPELINE - DETAILED ARCHITECTURE

## EXECUTIVE SUMMARY

The ingredient matching pipeline is a **two-stage cascade** that:
1. **Primary (Vector/Semantic)**: Uses pgvector embeddings via Gemini API (similarity threshold ≥ 0.7)
2. **Fallback (Fuzzy/Trigram)**: Uses PostgreSQL pg_trgm fuzzy matching (similarity threshold ≥ 0.7)

For each ingredient name:
1. Generate a Gemini embedding (with in-memory cache to avoid redundant API calls)
2. Query the vector DB using pgvector + HNSW index
3. If no match, fall back to fuzzy trigram search
4. If matched, fetch nutrition per 100g and re-rank candidates (boost-only, never penalize)
5. Classify confidence based on similarity score

---

## 1. CASCADE ARCHITECTURE

### File: `/lib/ai/matching/cascade.ts`

#### **Key Constants**

```typescript
export const CONFIDENCE_THRESHOLDS = {
  high: 0.6,    // ≥ 0.6 similarity → 'high' confidence
  medium: 0.3,  // ≥ 0.3 similarity → 'medium' confidence
};

// Acceptance thresholds
export const VECTOR_SIMILARITY_THRESHOLD = 0.7;      // Primary vector requirement
export const FUZZY_FALLBACK_THRESHOLD = 0.7;         // Fallback fuzzy requirement
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;       // Unused (legacy)
```

#### **Main Function: `matchIngredients()`**

**Signature:**
```typescript
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchResult>
```

**Process:**
- Takes list of ingredient names from meal decomposition
- Uses **bounded concurrency (MATCH_CONCURRENCY = 3)** to avoid exhausting Supabase PgBouncer connection pool
- Calls `matchSingleIngredient()` for each ingredient independently
- Collects results into matched/unmatched lists

**Concurrency Control:**
```typescript
const MATCH_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number = 3
): Promise<PromiseSettledResult<R>[]>
```
Workers process items sequentially but up to 3 can run in parallel.

#### **Core Function: `matchSingleIngredient()`**

**Signature:**
```typescript
async function matchSingleIngredient(
  ingredientName: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchedIngredient | null>
```

**Cascade Flow:**

**STAGE 1: Vector/Semantic Search (Primary)**
```typescript
const embedding = await gemini.generateEmbedding(ingredientName);
const vectorRows = await db.execute(
  sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`
);
const vectorResult = await buildMatchResult(
  ingredientName,
  vectorRows,
  VECTOR_SIMILARITY_THRESHOLD,  // 0.7
  db
);
if (vectorResult) return vectorResult;
```

- Calls `generateEmbedding()` which:
  - Checks in-memory cache first
  - If miss, calls Gemini API with retry logic (3 retries, exponential backoff)
  - Caches result before returning
- Calls PostgreSQL function `match_ingredients()` with:
  - `query_embedding`: The 768-dim vector
  - `match_count`: 3 (returns top 3 candidates)
  - `match_threshold`: 0.5 (loose DB-level filter; actual threshold applied in code)
- Calls `buildMatchResult()` with VECTOR_SIMILARITY_THRESHOLD (0.7)
- Returns if similarity ≥ 0.7

**STAGE 2: Fuzzy/Trigram Search (Fallback)**
```typescript
const fuzzyRows = await db.execute(
  sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`
);
const fuzzyResult = await buildMatchResult(
  ingredientName,
  fuzzyRows,
  FUZZY_FALLBACK_THRESHOLD,  // 0.7
  db
);
if (!fuzzyResult) {
  console.info(`[matching] "${ingredientName}" → unmatched`);
}
return fuzzyResult;
```

- Calls PostgreSQL function `fuzzy_match_ingredients()` with:
  - `query_text`: The ingredient name
  - `match_count`: 3
  - `match_threshold`: 0.15 (loose; actual threshold is 0.7)
- Calls `buildMatchResult()` with FUZZY_FALLBACK_THRESHOLD (0.7)
- Returns if similarity ≥ 0.7, otherwise returns null (unmatched)

**Return Type:**
```typescript
interface MatchedIngredient {
  ingredientName: string;                    // Original name queried
  foodCompositionId: string;                 // DB primary key
  matchedName: string;                       // name_primary from DB
  similarity: number;                        // 0-1 similarity score
  confidence: MatchConfidence;               // 'high' | 'medium' | 'low'
  nutritionPer100g: NutritionPer100g;        // 28 nutrients per 100g
}
```

#### **Supporting Functions**

**`rerankCandidates(query: string, candidates: FuzzyMatchRow[]): FuzzyMatchRow[]`**

Boost-only re-ranking (never penalizes):
```typescript
const boost = 
  q === name ? 0.15 :           // exact match
  name.startsWith(q) ? 0.1 :    // name starts with query (e.g. "gạo nếp" → "Gạo nếp cái")
  q.startsWith(name) ? 0.05 :   // query starts with name
  0;

return { ...c, similarity: c.similarity + boost };
```

Result sorted by new similarity descending.

**`buildMatchResult(ingredientName, rows, minSimilarity, db): MatchedIngredient | null`**

```typescript
if (rows.length === 0) return null;

const reranked = rerankCandidates(ingredientName, rows);
const topMatch = reranked[0];
if (topMatch.similarity < minSimilarity) return null;  // THRESHOLD CHECK

const nutrition = await fetchNutritionPer100g(topMatch.id, db);
if (!nutrition) return null;

return {
  ingredientName,
  foodCompositionId: topMatch.id,
  matchedName: topMatch.name_primary,
  similarity: topMatch.similarity,
  confidence: classifyConfidence(topMatch.similarity),
  nutritionPer100g: nutrition,
};
```

**`classifyConfidence(similarity: number): MatchConfidence`**

```typescript
if (similarity >= 0.6) return 'high';
if (similarity >= 0.3) return 'medium';
return 'low';
```

---

## 2. EMBEDDING GENERATION & CACHING

### File: `/lib/ai/gemini.ts`

#### **Embedding Configuration**

```typescript
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
```

#### **In-Memory Embedding Cache**

**Implementation:**
```typescript
const embeddingCache = new Map<string, number[]>();

export function getEmbeddingCacheStats() {
  return { size: embeddingCache.size };
}
```

**Key Properties:**
- **Module-level Map**: Persists across all requests in a single Node process
- **Keyed by ingredient name**: Vietnamese ingredient names recur across all users
- **No TTL/expiration**: Lives for process lifetime
- **Hit/miss logging**: Console logs with first 30 chars of text

**Cache Usage:**
```typescript
async generateEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) {
    console.info(`[gemini] embedding cache hit: "${text.slice(0, 30)}"`);
    return cached;
  }

  const embedding = await withRetry(async () => {
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text }] }],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const emb = result.embeddings?.[0]?.values;
    if (!emb) throw new Error('Gemini returned no embedding');
    return emb;
  }, `embed("${text.slice(0, 30)}")`);

  embeddingCache.set(text, embedding);
  console.info(
    `[gemini] embedding cache miss: "${text.slice(0, 30)}" (cache size: ${embeddingCache.size})`
  );
  return embedding;
}
```

#### **Rate Limiting & Retry Logic**

**Retry Configuration:**
```typescript
interface RetryOptions {
  maxRetries: number;      // Default: 3
  baseDelayMs: number;     // Default: 1000
}
```

**Rate Limit Detection & Backoff:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retry.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (!isRateLimitError(lastError) || attempt === retry.maxRetries) {
        throw lastError;
      }

      // Parse "retry in 60s" from 429 response, else exponential backoff
      const delay = parseRetryDelay(lastError, retry.baseDelayMs * attempt);
      console.warn(
        `[gemini] attempt ${attempt}/${retry.maxRetries} got 429, retrying in ${delay}ms`
      );
      await sleep(delay);
    }
  }
}
```

**Rate Limit Detection:**
```typescript
function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('429');
}

function parseRetryDelay(error: Error, baseDelayMs: number): number {
  const match = error.message.match(/retry in ([\d.]+)s/i);
  return match ? Number.parseFloat(match[1]) * 1000 : baseDelayMs;
}
```

---

## 3. DATABASE SCHEMA

### File: `/lib/db/schema.ts`

#### **Food Composition Table**

```typescript
export const vietnameseFoodComposition = pgTable(
  'vietnamese_food_composition',
  {
    id: text('id').primaryKey(),
    namePrimary: text('name_primary').notNull(),
    nameAlt: text('name_alt').array(),           // Alternative names
    nameEn: text('name_en').notNull(),           // English name
    typeVn: text('type_vn').notNull(),           // Vietnamese category
    typeEn: text('type_en').notNull(),           // English category
    source: text('source').notNull().default('FAO_VN_2007'),
    state: text('state').notNull(),              // 'raw' | 'cooked'
    inediblePortionPct: numeric('inedible_portion_pct'),
    
    // 28 Nutrients (all nullable, per 100g of edible portion)
    caloriesKcal: numeric('calories_kcal'),
    proteinG: numeric('protein_g'),
    carbohydrateG: numeric('carbohydrate_g'),
    fatG: numeric('fat_g'),
    fiberG: numeric('fiber_g'),
    sodiumMg: numeric('sodium_mg'),
    calciumMg: numeric('calcium_mg'),
    ironMg: numeric('iron_mg'),
    // ... (20 more minerals/vitamins)
    
    // Search infrastructure
    searchText: text('search_text'),              // Full concatenated text
    searchTextAscii: text('search_text_ascii'),   // Lowered, unaccented version
    embedding: vector('embedding', { dimensions: 768 }),  // Gemini-001 embedding
  }
);
```

**Vector Column:**
- **Type**: pgvector (768-dimensional)
- **Purpose**: Stores Gemini embedding-001 embeddings
- **Initial state**: NULL for existing rows; populated by backfill script

---

## 4. VECTOR SEARCH FUNCTION

### File: `/supabase/migrations/20260228155119_pgvector_embeddings.sql`

#### **SQL Function: `match_ingredients()`**

```sql
CREATE OR REPLACE FUNCTION public.match_ingredients(
  query_embedding vector(768),
  match_count int DEFAULT 3,
  match_threshold float DEFAULT 0.5
) RETURNS TABLE (
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vfc.id,
    vfc.name_primary,
    vfc.name_alt,
    vfc.name_en,
    vfc.state,
    1 - (vfc.embedding <=> query_embedding)::float AS similarity
  FROM public.vietnamese_food_composition vfc
  WHERE vfc.embedding IS NOT NULL
    AND 1 - (vfc.embedding <=> query_embedding)::float >= match_threshold
  ORDER BY vfc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Key Details:**
- **Vector operator**: `<=>` = cosine distance in pgvector
- **Similarity**: `1 - distance` converts to cosine similarity (0-1 range)
- **Filtering**: Keeps rows where similarity ≥ match_threshold (0.5, loose)
- **Ordering**: By distance ascending (most similar first)
- **Limit**: Returns top-N candidates (typically 3)

#### **HNSW Index**

```sql
CREATE INDEX IF NOT EXISTS idx_food_composition_embedding
  ON public.vietnamese_food_composition
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Configuration:**
- **Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Distance metric**: Cosine distance
- **Parameters**: m=16, ef_construction=64 (tuned for ~526 rows)
- **Why HNSW**: Better recall at small scale; no retraining needed unlike IVFFlat

---

## 5. FUZZY SEARCH FUNCTION

### Files:
- `/supabase/migrations/20260301022622_pg_trgm_ingredient_search.sql`
- `/supabase/migrations/20260313135722_fix_fuzzy_match_ranking.sql` (ranking fix)

#### **SQL Function: `fuzzy_match_ingredients()`**

```sql
CREATE OR REPLACE FUNCTION public.fuzzy_match_ingredients(
  query_text text,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.15
) RETURNS TABLE (
  id text,
  name_primary text,
  name_alt text[],
  name_en text,
  state text,
  similarity float
) AS $$
DECLARE
  has_diacritics boolean;
  normalized_query text;
BEGIN
  -- Detect Vietnamese diacritics
  normalized_query := lower(extensions.unaccent(query_text));
  has_diacritics := (normalized_query IS DISTINCT FROM lower(query_text));

  IF has_diacritics THEN
    -- Input has diacritics (e.g., "gạo") → search original search_text
    RETURN QUERY
    SELECT
      vfc.id, vfc.name_primary, vfc.name_alt, vfc.name_en, vfc.state,
      GREATEST(
        extensions.similarity(vfc.name_primary, query_text),
        extensions.similarity(COALESCE(array_to_string(vfc.name_alt, ' '), ''), query_text),
        extensions.similarity(COALESCE(vfc.name_en, ''), query_text)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(query_text, vfc.search_text) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    -- Input has no diacritics (e.g., "gao") → search search_text_ascii
    RETURN QUERY
    SELECT
      vfc.id, vfc.name_primary, vfc.name_alt, vfc.name_en, vfc.state,
      GREATEST(
        extensions.similarity(lower(extensions.unaccent(vfc.name_primary)), normalized_query),
        extensions.similarity(lower(extensions.unaccent(COALESCE(array_to_string(vfc.name_alt, ' '), ''))), normalized_query),
        extensions.similarity(lower(COALESCE(vfc.name_en, '')), normalized_query)
      )::float AS similarity
    FROM public.vietnamese_food_composition vfc
    WHERE extensions.word_similarity(normalized_query, vfc.search_text_ascii) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Key Features:**

**Diacritic Routing:**
- Detects if input contains Vietnamese diacritics (á, ă, â, etc.)
- **With diacritics** (e.g., "gạo"): Uses `search_text` (full-precision Vietnamese)
- **Without diacritics** (e.g., "gao"): Uses `search_text_ascii` (stripped via unaccent)
- **Why**: Vietnamese distinguishes via diacritics (bò≠bơ≠bổ); preserves precision

**Two-Stage Ranking (Post-March 2025 Fix):**
- **Filter**: `word_similarity()` >= 0.15 (broad, catches any word match)
- **Rank**: `GREATEST()` of per-column similarities (name_primary → name_alt → name_en)
- **Why**: Avoids dilution from English text in full search_text

**Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_food_composition_trgm
  ON vietnamese_food_composition USING gin (search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_food_composition_trgm_ascii
  ON vietnamese_food_composition USING gin (search_text_ascii gin_trgm_ops);
```

---

## 6. CANONICAL INGREDIENT NAMES

### File: `/lib/ai/prompts/decomposition.ts` (lines 51-74)

**Decomposition Prompt Rule:**

```
gạo tẻ              (not "cơm", "cơm trắng", "cơm nấu")
thịt lợn ba chỉ     (not "thịt heo kho", "thịt ba chỉ")
thịt gà             (not "gà luộc", "gà kho")
trứng gà            (chicken egg, not "quả trứng gà" which is ornamental)
đậu phụ             (not "đậu phụ chiên", "tofu xào")
bún tươi            (not "bún" when describing fresh vermicelli)
hạt tiêu đen        (not "tiêu đen", "tiêu")
đường trắng         (white sugar, exact form)
đường cát           (granulated sugar, exact form)
hành tím            (shallots, exact form)
dầu ăn              (cooking oil, not bare "dầu")
nước mắm            (fish sauce, exact form)
tỏi                 (garlic, exact form)
rau muống           (morning glory, exact form)
quả me chua         (tamarind, not bare "me")
giá đỗ              (bean sprouts, not bare "giá")
đậu xanh            (mung beans, not "đậu" alone)
nước dùng           (broth, exact form)
chả cá             (fish cake, exact form)
thịt bò             (beef)
sả                  (lemongrass)
mắm ruốc            (shrimp paste)
ớt tươi             (fresh chili)
```

Purpose: LLM uses these names during decomposition so matching encounters standard canonical names.

---

## 7. EMBEDDING BACKFILL SCRIPT

### File: `/scripts/backfill_embeddings.ts`

#### **Purpose:**
Generate and persist Gemini embeddings for all food composition records that lack them.

#### **Configuration:**

```typescript
const EMBEDDING_MODEL = 'gemini-embedding-001';
const BATCH_SIZE = 50;                    // Items per batch
const MAX_RETRIES = 5;
const BATCH_DELAY_MS = 35_000;           // 35s between batches
```

**Rate Limiting Math:**
- Free tier: 100 embed requests/min
- With BATCH_SIZE=50, spacing batches 35s apart → ~103 requests/min ✓

#### **Embedding Text Construction:**

```typescript
function buildEmbeddingText(row: {
  namePrimary: string;
  nameAlt: string[] | null;
  nameEn: string;
  typeVn: string;
  typeEn: string;
}): string {
  const alt = row.nameAlt?.length ? ` ${row.nameAlt.join(' ')}` : '';
  return `${row.namePrimary}${alt} ${row.nameEn} ${row.typeVn} ${row.typeEn}`;
}
```

Example: `"gạo tẻ  rice cây lương thực cereal crops"`

#### **Processing Loop:**

```typescript
async function main() {
  // 1. Query rows with NULL embedding
  const rows = await db
    .select({ id, namePrimary, nameAlt, nameEn, typeVn, typeEn })
    .from(vietnameseFoodComposition)
    .where(isNull(vietnameseFoodComposition.embedding));

  // 2. Batch process
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    // 3. Call Gemini API for batch
    const embeddings = await embedBatch(texts);

    // 4. Batch UPDATE using PostgreSQL unnest
    await updateBatch(
      batch.map(r => r.id),
      embeddings
    );

    // 5. Rate limiting
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}
```

#### **Error Handling:**

```typescript
async function embedBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts.map(text => ({ parts: [{ text }] })),
        config: { outputDimensionality: 768 },
      });
      return result.embeddings!.map(e => e.values!);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;

      // Parse "retry in 60s" from 429, else exponential backoff
      const retryMatch = err.message?.match(/retry in ([\d.]+)s/i);
      const delay = retryMatch
        ? Math.ceil(Number.parseFloat(retryMatch[1]) * 1000) + 1000
        : 1000 * 2 ** attempt;

      console.warn(`Retry ${attempt}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

---

## 8. GOAL ADJUSTMENT & BOUNDED ESTIMATES

### Files: `/lib/ai/goal-adjustment.ts`, `/lib/ai/pipeline/assembly.ts`

#### **Bounded Estimate Structure**

```typescript
interface BoundedEstimate {
  low: number;      // Pessimistic bound
  mid: number;      // Central estimate
  high: number;     // Optimistic bound
}
```

**In the pipeline:**
- **LLM Call 2** produces bounded estimates for 4 macros: calories, protein, carbs, fat
- **Non-LLM nutrients** (fiber, all micronutrients) use DB per-100g value with `{low=mid=high=scaled_value}`

#### **Goal Adjustment Formula**

```typescript
export function goalAdjust(
  estimate: BoundedEstimate | null,
  goal: Goal,
  aggression: number,
  nutrientKey: keyof NutritionValues
): number | null {
  if (estimate === null) return null;

  const isGoalAdjusted = GOAL_ADJUSTED_NUTRIENTS.includes(nutrientKey);

  if (!isGoalAdjusted || aggression === 0) {
    return estimate.mid;  // Non-adjusted nutrients always return mid
  }

  const direction = GOAL_BOUND_DIRECTION[goal][nutrientKey];
  const goalBound = direction === 'high' ? estimate.high : estimate.low;

  // Formula: displayed = mid + aggression × (goal_bound − mid)
  return estimate.mid + aggression * (goalBound - estimate.mid);
}
```

#### **Goal-Bound Direction**

```typescript
const GOAL_BOUND_DIRECTION: Record<Goal, Record<GoalAdjustedNutrient, 'high' | 'low'>> = {
  cutting: {
    caloriesKcal: 'high',      // Overestimate calories (pessimistic)
    proteinG: 'low',           // Underestimate protein (pessimistic)
    carbohydrateG: 'high',     // Overestimate carbs
    fatG: 'high',              // Overestimate fat
  },
  bulking: {
    caloriesKcal: 'low',       // Underestimate calories (optimistic)
    proteinG: 'high',          // Overestimate protein (optimistic)
    carbohydrateG: 'low',      // Underestimate carbs
    fatG: 'low',               // Underestimate fat
  },
  maintaining: {
    caloriesKcal: 'high',
    proteinG: 'low',
    carbohydrateG: 'high',
    fatG: 'high',
  },
};
```

#### **Aggression Parameter**

- **Range**: 0.1–0.8 for cutting/bulking; 0 for maintaining
- **Meaning**: How far to push displayed values toward goal bound
  - aggression=0 → display `mid` (no adjustment)
  - aggression=0.5 → display midpoint between `mid` and goal bound
  - aggression=1.0 → display goal bound directly

**Example: Cutting, 100 cal estimate {low:90, mid:100, high:110}, aggression=0.5**
- Goal bound = 'high' (overestimate calories)
- Displayed = 100 + 0.5 × (110 − 100) = 105 kcal

#### **Non-Adjusted Nutrients**

All 28 nutrients are stored as bounded estimates, but only 4 are goal-adjusted:
- **Goal-adjusted (4)**: calories, protein, carbs, fat
- **Always display mid (24)**: fiber, sodium, calcium, iron, etc.

---

## 9. COMPLETE CASCADE FLOW

```
Input: User meal description "cơm thịt kho trứng"
  ↓
LLM Call 1: Decomposition
  ├─ Produces: gạo tẻ, thịt lợn ba chỉ, trứng gà, đường trắng, nước mắm, dầu ăn
  └─ Output: DecomposedIngredient[] with estimatedGrams & cookingMethod
  ↓
matchIngredients(ingredients, mealContext, db, gemini)
  [for each ingredient, concurrency=3]
  ├─ "gạo tẻ"
  │  ├─ embed() → cache miss → API call (0.123s) → cache → return 768-dim vector
  │  ├─ match_ingredients(vector, 3, 0.5) → HNSW search → [rank1: 0.85, rank2: 0.72, rank3: 0.61]
  │  ├─ rerankCandidates() → no boost (no exact match) → sorted [0.85, 0.72, 0.61]
  │  ├─ buildMatchResult(0.85, min=0.7) → ✓ PASS → fetchNutritionPer100g() → MatchedIngredient
  │  └─ return MatchedIngredient { foodCompositionId: 'rice-001', similarity: 0.85, confidence: 'high' }
  │
  ├─ "thịt lợn ba chỉ"
  │  ├─ embed() → cache hit → return 768-dim vector (0.001s)
  │  ├─ match_ingredients() → HNSW search → [0.68, 0.52, 0.45]
  │  ├─ buildMatchResult(0.68, min=0.7) → ✗ FAIL (0.68 < 0.7)
  │  ├─ fuzzy_match_ingredients() → pg_trgm search → [0.75, 0.68, 0.52]
  │  ├─ rerankCandidates(0.75) → startsWith match +0.1 boost → 0.85
  │  ├─ buildMatchResult(0.85, min=0.7) → ✓ PASS → MatchedIngredient
  │  └─ return MatchedIngredient { similarity: 0.85, confidence: 'high' }
  │
  ├─ ... [5 more ingredients, similar flow]
  │
  └─ "dầu ăn"
     ├─ embed() → cache hit → vector
     ├─ match_ingredients() → [0.52, 0.48, 0.41]
     ├─ buildMatchResult(0.52, min=0.7) → ✗ FAIL
     ├─ fuzzy_match_ingredients() → [0.68, 0.55, 0.42]
     ├─ buildMatchResult(0.68, min=0.7) → ✗ FAIL
     ├─ logUnmatchedIngredients()
     └─ return null
  ↓
Result: { matched: [5 MatchedIngredient], unmatched: [{ ingredientName: 'dầu ăn' }] }
  ↓
fetchNutritionPer100g() for each matched ingredient
  └─ Returns 28 nutrients for each
  ↓
mergeNutrition() — Combine LLM bounded estimates + DB values
  ├─ LLM estimates (from Call 2): calories, protein, carbs, fat {low, mid, high}
  ├─ DB per-100g scaled: fiber, sodium, iron, etc. {low=mid=high=scaled_value}
  └─ Result: BoundedNutrition (28 nutrients, each with low/mid/high or null)
  ↓
computeRawEquivalent() — Apply cooking factor
  ├─ cookingMethod: "nấu" → factor 0.38 → 170g cooked × 0.38 = 65g raw
  ├─ cookingMethod: "kho" → factor 0.8 → 100g cooked × 0.8 = 80g raw
  ├─ cookingMethod: null → factor 1.0 → same weight
  └─ Results stored in ProcessedIngredient.rawEquivalentGrams
  ↓
goalAdjustNutrition(boundedNutrition, goal='cutting', aggression=0.5)
  ├─ For each 4 goal-adjusted nutrients:
  │  └─ displayed = mid + aggression × (goal_bound − mid)
  ├─ For each 24 non-adjusted nutrients:
  │  └─ displayed = mid
  └─ Result: NutritionValues (28 nutrients, single flat values)
  ↓
Final meal stored in database with:
  - 28 bounded nutrients (low/mid/high)
  - 28 goal-adjusted displayed nutrients
  - Individual ingredient details
  - Confidence scores
```

---

## 10. KEY THRESHOLDS & CONFIGURATION

| Config | Value | Purpose |
|--------|-------|---------|
| **Similarity Thresholds** |
| `VECTOR_SIMILARITY_THRESHOLD` | 0.7 | Min cosine similarity for vector match acceptance |
| `FUZZY_FALLBACK_THRESHOLD` | 0.7 | Min trigram similarity for fuzzy match acceptance |
| `CONFIDENCE_THRESHOLDS.high` | 0.6 | Classify similarity as 'high' confidence |
| `CONFIDENCE_THRESHOLDS.medium` | 0.3 | Classify similarity as 'medium' confidence |
| **Concurrency & Rate Limiting** |
| `MATCH_CONCURRENCY` | 3 | Max concurrent DB lookups |
| `DEFAULT_RETRY.maxRetries` | 3 | Max Gemini API retries |
| `DEFAULT_RETRY.baseDelayMs` | 1000 | Base exponential backoff (ms) |
| **Embedding Configuration** |
| `EMBEDDING_MODEL` | 'gemini-embedding-001' | Gemini model |
| `EMBEDDING_DIMENSIONS` | 768 | Vector size |
| **Backfill Configuration** |
| `BATCH_SIZE` | 50 | Items per embedding batch |
| `BATCH_DELAY_MS` | 35000 | Rate limiting between batches (35s) |
| `MAX_RETRIES` (backfill) | 5 | Backfill retry attempts |
| **HNSW Index** |
| `m` | 16 | HNSW neighbor count |
| `ef_construction` | 64 | HNSW construction parameter |

---

## 11. CACHING MECHANISMS

### **Embedding Cache (In-Memory)**
- **Location**: Module scope in `/lib/ai/gemini.ts`
- **Type**: `Map<string, number[]>`
- **Lifespan**: Per Node.js process (cleared on restart)
- **Key**: Ingredient name (string)
- **Value**: 768-dimensional embedding vector
- **Hit rate optimization**: Vietnamese ingredient names recur across all users
- **Visible for testing**: `getEmbeddingCacheStats() → { size: number }`

### **Database Indexes (Query Caching)**
- **Vector search**: HNSW index provides O(log n) amortized lookup
- **Fuzzy search**: GIN trigram indexes provide fast prefix matching

### **No Match Caching**
- Unmatched ingredients logged to DB but not cached in memory
- Fresh searches on every request (enables feedback loop for DB expansion)

---

## 12. EXPORTED FUNCTIONS & TYPES

### From `/lib/ai/matching/index.ts`:

```typescript
// Constants
export const CONFIDENCE_THRESHOLDS;
export const FUZZY_FALLBACK_THRESHOLD;
export const FUZZY_SIMILARITY_THRESHOLD;
export const VECTOR_SIMILARITY_THRESHOLD;

// Functions
export function classifyConfidence(similarity: number): MatchConfidence;
export async function matchIngredients(...): Promise<MatchResult>;
export function rerankCandidates(...): FuzzyMatchRow[];

// Types
export interface MatchResult;

// Utilities
export { fetchNutritionPer100g, logUnmatchedIngredients, parseNutritionRow };
```

---

## 13. KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `lib/ai/matching/cascade.ts` | Core cascade logic, re-ranking, confidence classification |
| `lib/ai/matching/nutrition-db.ts` | Nutrition fetching, unmatched ingredient logging |
| `lib/ai/matching/index.ts` | Public exports |
| `lib/ai/gemini.ts` | Gemini client, embedding generation, in-memory cache, retry logic |
| `lib/ai/types.ts` | Type definitions (MatchedIngredient, MatchConfidence, etc.) |
| `lib/ai/constants.ts` | Cooking factors, goal adjustment config, nutrition keys |
| `lib/ai/goal-adjustment.ts` | Goal adjustment formulas and nutrient summation |
| `lib/ai/pipeline/assembly.ts` | Merge LLM + DB nutrition, compute confidence, assemble results |
| `lib/db/schema.ts` | Drizzle schema for vietnameseFoodComposition table |
| `lib/ai/prompts/decomposition.ts` | Decomposition prompt with canonical ingredient names |
| `scripts/backfill_embeddings.ts` | Embedding generation with batching & rate limiting |
| `supabase/migrations/20260228155119_pgvector_embeddings.sql` | Vector search (pgvector, HNSW index, match_ingredients function) |
| `supabase/migrations/20260301022622_pg_trgm_ingredient_search.sql` | Fuzzy search setup (pg_trgm, GIN indexes, fuzzy_match_ingredients function) |
| `supabase/migrations/20260313135722_fix_fuzzy_match_ranking.sql` | Ranking fix: per-column similarity |

---

## 14. DESIGN DECISIONS

### **Vector-First Cascade**

Why vector search is primary:
- **Goal**: Catch semantic synonyms ("cơm nấu" → "gạo tẻ")
- **Accuracy**: Vectors more robust than fuzzy for Vietnamese food synonymy
- **Fallback**: Fuzzy catches typos when semantic search fails

### **Strict Thresholds (0.7)**

- **Why both at 0.7?**: Consistency; prevents cascading uncertainty
- **Why not lower?**: Avoids false positives that accumulate in nutrition calculations

### **Re-Ranking with Boosts Only**

```typescript
if (q === name) boost = 0.15;           // Exact match
else if (name.startsWith(q)) boost = 0.1;  // Prefix match
else if (q.startsWith(name)) boost = 0.05; // Query prefix match
else boost = 0;
```

- **Never penalizes**: Derived products (Bột, Bánh, Quả prefixes) always retained if they matched
- **Preserves diversity**: Candidate ranking reflects semantic similarity first

### **Diacritic-Aware Fuzzy Search**

Vietnamese diacritics load-bearing meaning:
- bò = beef
- bơ = butter
- bổ = nutritious (adjective)

Function detects diacritics and routes to appropriate column:
- Diacritics present → full `search_text` (precision)
- No diacritics → `search_text_ascii` (lenient)

### **In-Memory Embedding Cache**

- **Per-process cache** because ingredient names repeat across users
- **No TTL** because food compositions don't change within process lifetime
- **Visible metrics** for debugging/monitoring

### **Bounded Concurrency (3)**

- **Why 3?**: Supabase PgBouncer pool limits concurrent connections
- **Why not higher?**: Risk exhausting session pool and failing all concurrent matches
- **Sequential fallback**: If one match fails, worker processes next ingredient

---

## 15. TESTING ENTRY POINTS

**Quick Pipeline Test:**
```bash
bun --env-file=.env.local scripts/test-pipeline.ts "cơm thịt kho trứng"
```

**Backfill Embeddings:**
```bash
bun --env-file=.env.local scripts/backfill_embeddings.ts
```

**Cache Stats (in code):**
```typescript
const stats = getEmbeddingCacheStats();
console.log(`Cache size: ${stats.size} vectors`);
```
