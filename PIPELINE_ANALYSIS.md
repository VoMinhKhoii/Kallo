# AI Nutrition Pipeline Deep Analysis

## 1. DB LOOKUP / INGREDIENT MATCHING

### File: `/Users/khoivo/Documents/nham/lib/ai/matching/cascade.ts`

#### 1.1 Main Entry Point: `matchIngredients()`
**Lines 49-83**: Orchestrates the cascading match → unmatched flow

```typescript
export async function matchIngredients(
  ingredients: DecomposedIngredient[],
  mealContext: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchResult> {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];

  const results = await Promise.allSettled(
    ingredients.map((ingredient) =>
      matchSingleIngredient(ingredient.name, db, gemini)
    )
  );

  for (let i = 0; i < ingredients.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      matched.push(result.value);
    } else {
      // ...
      unmatched.push({
        ingredientName: ingredients[i].name,
        mealContext,  // <-- PASSED IN from orchestrator (rawInput)
      });
    }
  }

  return { matched, unmatched };
}
```

**Key Points**:
- Runs `matchSingleIngredient()` in parallel via `Promise.allSettled()`
- `mealContext` is the raw user input (passed in from orchestrator)
- Returns `{ matched: MatchedIngredient[], unmatched: UnmatchedIngredient[] }`

#### 1.2 Single Ingredient Cascade: `matchSingleIngredient()`
**Lines 85-113**: The fuzzy → vector cascade

```typescript
async function matchSingleIngredient(
  ingredientName: string,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<MatchedIngredient | null> {
  // Step 1: Try fuzzy match (pg_trgm)
  const fuzzyRows = await db.execute(
    sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`
  );
  const fuzzyResult = await buildMatchResult(
    ingredientName,
    fuzzyRows as unknown as FuzzyMatchRow[],
    FUZZY_SIMILARITY_THRESHOLD,  // 0.4
    db
  );
  if (fuzzyResult) return fuzzyResult;

  // Step 2: Fall back to vector search (pgvector)
  const embedding = await gemini.generateEmbedding(ingredientName);
  const vectorRows = await db.execute(
    sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`
  );
  return buildMatchResult(
    ingredientName,
    vectorRows as unknown as FuzzyMatchRow[],
    VECTOR_SIMILARITY_THRESHOLD,  // 0.75
    db
  );
}
```

**ORDER OF OPERATIONS**:
1. **Fuzzy (pg_trgm) first** - Lines 91-100
   - Calls `fuzzy_match_ingredients(ingredientName, 3, 0.15)`
   - Uses threshold: **FUZZY_SIMILARITY_THRESHOLD = 0.4** (Line 18)
   - Returns immediately if match found

2. **Vector (pgvector) fallback** - Lines 102-112
   - Only called if fuzzy returns null
   - Generates embedding via Gemini
   - Calls `match_ingredients(embedding_vector, 3, 0.5)`
   - Uses threshold: **VECTOR_SIMILARITY_THRESHOLD = 0.75** (Line 21)

#### 1.3 Thresholds
**File: `/Users/khoivo/Documents/nham/lib/ai/matching/cascade.ts` Lines 12-27**

```typescript
export const CONFIDENCE_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
} as const;

/** Minimum similarity to accept a fuzzy (pg_trgm) match */
export const FUZZY_SIMILARITY_THRESHOLD = 0.4;

/** Minimum similarity to accept a vector (pgvector) match */
export const VECTOR_SIMILARITY_THRESHOLD = 0.75;

export function classifyConfidence(similarity: number): MatchConfidence {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}
```

**Summary**:
- **Fuzzy match**: Require similarity ≥ **0.4** to accept
- **Vector match**: Require similarity ≥ **0.75** to accept (much stricter)
- Confidence classification: high (≥0.6), medium (≥0.3), low (<0.3)

### SQL Functions

#### 1.4 `fuzzy_match_ingredients()` Function

**File: `/Users/khoivo/Documents/nham/supabase/migrations/20260313135722_fix_fuzzy_match_ranking.sql` Lines 5-65**

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
  normalized_query := lower(extensions.unaccent(query_text));
  has_diacritics := (normalized_query IS DISTINCT FROM lower(query_text));

  IF has_diacritics THEN
    -- Vietnamese input with diacritics
    -- Filter: word_similarity catches matches via any column (name, alt, English)
    -- Rank: best per-column similarity avoids English text dilution
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
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
    -- ASCII input (English or unaccented Vietnamese)
    -- Same two-stage: broad filter + per-column ranking
    RETURN QUERY
    SELECT
      vfc.id,
      vfc.name_primary,
      vfc.name_alt,
      vfc.name_en,
      vfc.state,
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

**Signature**: `fuzzy_match_ingredients(query_text TEXT, match_count INT = 5, match_threshold FLOAT = 0.15)`

**Returns**: `TABLE(id, name_primary, name_alt, name_en, state, similarity)`

**Strategy**:
- Detects Vietnamese diacritics in input (line 22)
- Two-stage filtering:
  - **Broad filter**: `word_similarity()` >= threshold (catches any column match)
  - **Rank**: `GREATEST()` of per-column similarities (avoids English text dilution)
- **With diacritics** (Line 24-43): Search `search_text` column
- **Without diacritics** (Line 44-62): Search `search_text_ascii` column (normalized)

#### 1.5 `match_ingredients()` Vector Function

**File: `/Users/khoivo/Documents/nham/supabase/migrations/20260228155119_pgvector_embeddings.sql` Lines 53-80**

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

**Signature**: `match_ingredients(query_embedding VECTOR(768), match_count INT = 3, match_threshold FLOAT = 0.5)`

**Returns**: `TABLE(id, name_primary, name_alt, name_en, state, similarity)`

**Key Details**:
- Uses pgvector cosine distance operator `<=>` (line 73)
- Similarity = `1 - distance` (line 73)
- Filters: embedding NOT NULL AND similarity >= threshold (lines 75-76)
- Orders by distance (closest first) (line 77)
- Returns top N (line 78)

---

## 2. PIPELINE ASSEMBLY (Step 3 → Step 4)

### File: `/Users/khoivo/Documents/nham/lib/ai/pipeline/assembly.ts`

#### 2.1 Entry Point: `assembleResult()`
**Lines 110-198**: Merges decomposition + nutrition + matched ingredients → final result

```typescript
export function assembleResult(
  decomposition: MealDecomposition,
  nutrition: NutritionAdjustment,
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext
): PipelineResult {
  const { goal, aggression } = userContext;
  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Flatten all Step 3 ingredients into a single map keyed by ingredientName.
  // This makes assembly resilient to LLM regrouping meal items between steps.
  const llmNutritionByIngredient = new Map<string, IngredientLlmNutrition>();
  for (const mi of nutrition.mealItems) {
    for (const ing of mi.ingredients) {
      llmNutritionByIngredient.set(ing.ingredientName, ing);  // <-- KEY SET
    }
  }

  const pipelineMealItems: PipelineMealItem[] = decomposition.mealItems.map(
    (decomposedItem) => {
      const ingredients: ProcessedIngredient[] = decomposedItem.ingredients.map(
        (ing) => {
          const matchInfo = matchedLookup.get(ing.name);
          const llmData = llmNutritionByIngredient.get(ing.name);  // <-- KEY GET

          // estimatedGrams is the cooked/as-eaten weight (user-facing).
          // rawEquivalentGrams is used for DB nutrition scaling only.
          const rawEquivalentGrams = computeRawEquivalent(
            ing.estimatedGrams,
            ing.cookingMethod
          );

          const boundedNutrition = llmData
            ? mergeNutrition(
                llmData,
                matchInfo?.nutritionPer100g ?? null,
                rawEquivalentGrams
              )
            : nullBoundedNutrition();

          const displayedNutrition = goalAdjustNutrition(
            boundedNutrition,
            goal,
            aggression
          );

          return {
            ingredientName: ing.name,
            foodCompositionId: matchInfo?.foodCompositionId ?? null,
            estimatedGrams: ing.estimatedGrams,
            rawEquivalentGrams,
            cookingMethod: ing.cookingMethod,
            userFacingUnit: ing.userFacingUnit,
            matchConfidence: matchInfo?.similarity ?? null,
            boundedNutrition,
            displayedNutrition,
          };
        }
      );

      return {
        name: decomposedItem.name,
        ingredients,
        boundedNutrition: sumBoundedNutrition(
          ingredients.map((i) => i.boundedNutrition)
        ),
        displayedNutrition: sumDisplayedNutrition(
          ingredients.map((i) => i.displayedNutrition)
        ),
      };
    }
  );

  const allIngredients = pipelineMealItems.flatMap((mi) => mi.ingredients);

  return {
    mealItems: pipelineMealItems,
    mealSlot: decomposition.mealSlot,
    confidenceOverall: computeOverallConfidence(matched, unmatched),
    boundedNutrition: sumBoundedNutrition(
      allIngredients.map((i) => i.boundedNutrition)
    ),
    displayedNutrition: sumDisplayedNutrition(
      allIngredients.map((i) => i.displayedNutrition)
    ),
    unmatchedIngredients: unmatched,
  };
}
```

#### 2.2 THE "LAST-WRITE-WINS" BUG

**Location**: Line 122-127

```typescript
const llmNutritionByIngredient = new Map<string, IngredientLlmNutrition>();
for (const mi of nutrition.mealItems) {
  for (const ing of mi.ingredients) {
    llmNutritionByIngredient.set(ing.ingredientName, ing);  // <-- BUG HERE
  }
}
```

**Problem**:
- Uses **only** `ingredientName` as the key (line 125)
- No `mealItemName` context is stored
- If the same ingredient appears in **multiple meal items** (e.g., "gạo" in both "cơm trắng" and "cơm chiên"):
  - First iteration: `set("gạo", {ingredientName: "gạo", caloriesKcal: {...}, ...})`
  - Second iteration: `set("gạo", {ingredientName: "gạo", caloriesKcal: {...}, ...})` — **OVERWRITES**
  - Last write wins; previous meal item's nutrition is lost

**How it's used** (Line 134):
```typescript
const llmData = llmNutritionByIngredient.get(ing.name);  // Only looks up by ingredient name
```

**The join key**: 
- **Single key**: `ingredientName` (line 125, 134)
- **No context**: Meal item context is completely lost
- **Vulnerability**: Duplicate ingredients across meal items cause data loss

---

## 3. STEP 3 PROMPT / UNMATCHED INGREDIENTS

### File: `/Users/khoivo/Documents/nham/lib/ai/prompts/nutrition.ts`

#### 3.1 Unmatched Ingredients XML Block
**Lines 79-94**

```typescript
let unmatchedSection = '';
if (unmatched.length > 0) {
  unmatchedSection = '\n<unmatched_ingredients>\n';
  unmatchedSection +=
    '  <!-- No DB match found. Use your knowledge of Vietnamese cuisine for these. -->\n';
  for (const u of unmatched) {
    const ing = mealItems
      .flatMap((mi) => mi.ingredients)
      .find((i) => i.name === u.ingredientName);
    const rawGrams = ing
      ? computeRawGrams(ing.estimatedGrams, ing.cookingMethod)
      : '?';
    unmatchedSection += `  <ingredient name="${u.ingredientName}" raw_grams="${rawGrams}"${ing?.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''} />\n`;
  }
  unmatchedSection += '</unmatched_ingredients>\n';
}
```

**Current XML output**:
```xml
<unmatched_ingredients>
  <!-- No DB match found. Use your knowledge of Vietnamese cuisine for these. -->
  <ingredient name="thịt chua" raw_grams="120" cooking="kho" />
  <ingredient name="rare_herb" raw_grams="?" />
</unmatched_ingredients>
```

**Issues**:
- No `mealContext` field (the meal item name context is lost)
- No link back to which meal item this ingredient belonged to
- LLM can't correlate unmatched ingredient to meal item

#### 3.2 Unmatched Rule in Prompt
**Lines 135-139**

```
  <unmatched_rule>
    For ingredients in <unmatched_ingredients>: use fallback estimation from your knowledge
    of standard Vietnamese food composition, then apply the same Steps 1–3 above.
    Treat these estimates as inherently wider — set LOW 15% below MID and HIGH 25% above MID.
  </unmatched_rule>
```

**Current behavior**:
- LLM treats unmatched ingredients with wider bounds (−15%, +25%)
- **No context** about which meal item each unmatched ingredient belongs to
- LLM doesn't know if "thịt chua" was part of "canh chua" or "thịt chua kho"

#### 3.3 DB-Matched Ingredients XML Block
**Lines 59-77**

```typescript
let ingredientData = '<ingredient_data>\n';
ingredientData +=
  '  <!-- DB values are per 100g RAW uncooked weight. estimatedGrams is also RAW. -->\n\n';

for (const mealItem of mealItems) {
  ingredientData += `  <meal_item name="${mealItem.name}">\n`;

  for (const ing of mealItem.ingredients) {
    const match = matchedLookup.get(ing.name);
    if (match) {
      const rawGrams = computeRawGrams(ing.estimatedGrams, ing.cookingMethod);
      ingredientData += `    <ingredient name="${ing.name}" source="db_matched" db_name="${match.matchedName}" raw_grams="${rawGrams}"${ing.cookingMethod ? ` cooking="${ing.cookingMethod}"` : ''}>\n`;
      ingredientData += `      <per_100g_raw calories="${match.nutritionPer100g.caloriesKcal ?? '?'}" protein="${match.nutritionPer100g.proteinG ?? '?'}g" carbs="${match.nutritionPer100g.carbohydrateG ?? '?'}g" fat="${match.nutritionPer100g.fatG ?? '?'}g" />\n`;
      ingredientData += `    </ingredient>\n`;
    }
  }
  ingredientData += `  </meal_item>\n`;
}
ingredientData += '</ingredient_data>\n';
```

**Output example**:
```xml
<ingredient_data>
  <!-- DB values are per 100g RAW uncooked weight. estimatedGrams is also RAW. -->

  <meal_item name="cơm trắng">
    <ingredient name="gạo tẻ" source="db_matched" db_name="Gạo tẻ (Rice, white)" raw_grams="65" cooking="nấu">
      <per_100g_raw calories="352" protein="6.8g" carbs="78.2g" fat="0.5g" />
    </ingredient>
  </meal_item>

  <meal_item name="thịt kho trứng">
    <ingredient name="thịt lợn ba chỉ" source="db_matched" db_name="Thịt lợn ba chỉ (Pork belly)" raw_grams="120" cooking="kho">
      <per_100g_raw calories="258" protein="16.8g" carbs="0g" fat="21.1g" />
    </ingredient>
  </meal_item>
</ingredient_data>
```

#### 3.4 Is `mealContext` field in Step 2 output?

**Answer: NO**

**UnmatchedIngredient type** (File: `/Users/khoivo/Documents/nham/lib/ai/types.ts` Lines 138-141):
```typescript
export interface UnmatchedIngredient {
  ingredientName: string;
  mealContext: string;  // <-- This is the RAW USER INPUT, not the meal item name
}
```

**Where `mealContext` comes from** (File: `/Users/khoivo/Documents/nham/lib/ai/pipeline/orchestrator.ts` Line 90-92):
```typescript
const matchResult = await matchIngredients(
  allIngredients,
  rawInput,  // <-- This is mealContext (user's raw input like "cơm thịt kho")
  db,
  gemini
);
```

**Used in nutrition prompt** (Line 146):
```typescript
buildNutritionPrompt(
  mealItems,
  matched,
  unmatched,
  userContext
);
```

**Not included in `NutritionAdjustment` schema**:
- Step 2 output does NOT include the meal item context
- The unmatched ingredients XML block has no link back to meal items

---

## 4. TYPES AND SCHEMAS

### File: `/Users/khoivo/Documents/nham/lib/ai/types.ts`

#### 4.1 Ingredient-Related Types

**MatchedIngredient** (Lines 128-135):
```typescript
export interface MatchedIngredient {
  ingredientName: string;
  foodCompositionId: string;
  matchedName: string;
  similarity: number;
  confidence: MatchConfidence;
  nutritionPer100g: NutritionPer100g;
}
```

**UnmatchedIngredient** (Lines 138-141):
```typescript
export interface UnmatchedIngredient {
  ingredientName: string;
  mealContext: string;  // Raw user input
}
```

**IngredientLlmNutrition** (Lines 148-154):
```typescript
export interface IngredientLlmNutrition {
  ingredientName: string;
  caloriesKcal: BoundedEstimate;
  proteinG: BoundedEstimate;
  carbohydrateG: BoundedEstimate;
  fatG: BoundedEstimate;
}
```
⚠️ **NOTE**: No `mealItemName` field — this is the bug!

**MealItemNutrition** (Lines 157-160):
```typescript
export interface MealItemNutrition {
  mealItemName: string;
  ingredients: IngredientLlmNutrition[];
}
```

#### 4.2 Step 3 Output Schema

**File: `/Users/khoivo/Documents/nham/lib/ai/schemas.ts` Lines 102-129**

```typescript
export const ingredientLlmNutritionSchema = z.object({
  ingredientName: z
    .string()
    .describe('Must match the ingredient name from decomposition'),
  caloriesKcal: boundedEstimateSchema.describe('Calories in kcal'),
  proteinG: boundedEstimateSchema.describe('Protein in grams'),
  carbohydrateG: boundedEstimateSchema.describe('Carbohydrates in grams'),
  fatG: boundedEstimateSchema.describe('Fat in grams'),
});

export const mealItemNutritionSchema = z.object({
  mealItemName: z
    .string()
    .describe('Must match the meal item name from decomposition'),
  ingredients: z
    .array(ingredientLlmNutritionSchema)
    .min(1)
    .describe(
      'Bounded nutrition per ingredient (5 key nutrients), adjusted for cooking method and portion'
    ),
});

export const nutritionAdjustmentSchema = z.object({
  mealItems: z
    .array(mealItemNutritionSchema)
    .min(1)
    .describe('Bounded nutrition for each meal item from decomposition'),
});
```

**Schema structure**:
```
NutritionAdjustment {
  mealItems: [
    {
      mealItemName: "cơm trắng",        // <-- Present here
      ingredients: [
        {
          ingredientName: "gạo tẻ",     // <-- Present here
          caloriesKcal: { low, mid, high },
          proteinG: { low, mid, high },
          // ... 2 more nutrients
        }
      ]
    }
  ]
}
```

⚠️ **SCHEMA MISMATCH**: `ingredientLlmNutritionSchema` has NO `mealItemName` field, but the parent `MealItemNutrition` has it. The ingredient object itself loses context during the flattening step in `assembleResult()`.

#### 4.3 ProcessedIngredient (Pipeline Result)

**File: `/Users/khoivo/Documents/nham/lib/ai/types.ts` Lines 171-182**

```typescript
export interface ProcessedIngredient {
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number;
  rawEquivalentGrams: number;
  cookingMethod: string | null;
  userFacingUnit: string | null;
  matchConfidence: number | null;
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
}
```

⚠️ **NOTE**: No `mealItemName` here either. The ingredient is decontextualized.

---

## 5. DATABASE FUNCTIONS

### File: `/Users/khoivo/Documents/nham/supabase/migrations/`

#### 5.1 `fuzzy_match_ingredients()` Details

**Migration File**: `20260313135722_fix_fuzzy_match_ranking.sql` (Latest version)
**Lines**: 5-65

**Signature**:
```sql
fuzzy_match_ingredients(
  query_text TEXT,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.15
) → TABLE(id, name_primary, name_alt, name_en, state, similarity)
```

**What it does**:
1. Detects Vietnamese diacritics in the input (line 22)
2. If diacritics present: searches `search_text` column using per-column similarity
3. If ASCII: searches `search_text_ascii` column (unaccented) using per-column similarity
4. Uses **two-stage filtering**:
   - Broad: `word_similarity()` >= match_threshold (any column)
   - Rank: `GREATEST()` of per-column similarities
5. Returns top N by similarity (descending)

**Called from**: `/Users/khoivo/Documents/nham/lib/ai/matching/cascade.ts` Line 91-92
```typescript
const fuzzyRows = await db.execute(
  sql`SELECT * FROM fuzzy_match_ingredients(${ingredientName}, 3, 0.15)`
);
```

**Parameters passed**:
- `query_text`: ingredient name (e.g., "gạo tẻ")
- `match_count`: 3 (return top 3 candidates)
- `match_threshold`: 0.15 (internal word_similarity threshold; not the acceptance threshold)

**Acceptance logic**: (in TypeScript at line 98 in cascade.ts)
```typescript
const fuzzyResult = await buildMatchResult(
  ingredientName,
  fuzzyRows,
  FUZZY_SIMILARITY_THRESHOLD,  // 0.4 is the acceptance threshold
  db
);
```

#### 5.2 `match_ingredients()` Vector Function Details

**Migration File**: `20260228155119_pgvector_embeddings.sql`
**Lines**: 53-80

**Signature**:
```sql
match_ingredients(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 3,
  match_threshold FLOAT DEFAULT 0.5
) → TABLE(id, name_primary, name_alt, name_en, state, similarity)
```

**What it does**:
1. Takes a 768-dimensional vector embedding (Gemini)
2. Computes cosine distance to all foods in DB
3. Converts distance to similarity: `similarity = 1 - distance`
4. Filters: embedding NOT NULL AND similarity >= threshold
5. Orders by distance (closest first)
6. Returns top N

**Vector math** (Line 73):
```sql
1 - (vfc.embedding <=> query_embedding)::float AS similarity
```
- `<=>` is pgvector's cosine distance operator
- Range: [0, 2] for cosine (0 = identical, 2 = opposite)
- Converted to similarity: 1 - distance gives range [−1, 1]
- For similar vectors: similarity ≈ 1
- For dissimilar: similarity ≈ 0 or negative

**Called from**: `/Users/khoivo/Documents/nham/lib/ai/matching/cascade.ts` Line 104-105
```typescript
const embedding = await gemini.generateEmbedding(ingredientName);
const vectorRows = await db.execute(
  sql`SELECT * FROM match_ingredients(${JSON.stringify(embedding)}::vector, 3, 0.5)`
);
```

**Acceptance logic** (Line 107-110):
```typescript
return buildMatchResult(
  ingredientName,
  vectorRows,
  VECTOR_SIMILARITY_THRESHOLD,  // 0.75 is the acceptance threshold
  db
);
```

#### 5.3 Helper: `buildMatchResult()`

**File**: `/Users/khoivo/Documents/nham/lib/ai/matching/cascade.ts` Lines 115-137

```typescript
async function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  db: PostgresJsDatabase
): Promise<MatchedIngredient | null> {
  if (rows.length === 0) return null;

  const topMatch = rows[0];
  if (topMatch.similarity < minSimilarity) return null;  // <-- Acceptance threshold

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
}
```

**Flow**:
1. Takes top match from SQL function results
2. Applies acceptance threshold (line 124)
3. Fetches full nutrition from DB using `foodCompositionId`
4. Returns wrapped `MatchedIngredient` with confidence

---

## SUMMARY TABLE

| Area | File | Lines | Key Finding |
|------|------|-------|-------------|
| **Fuzzy threshold** | `cascade.ts` | 18 | 0.4 |
| **Vector threshold** | `cascade.ts` | 21 | 0.75 |
| **Cascade order** | `cascade.ts` | 91-112 | Fuzzy first, then vector fallback |
| **Fuzzy SQL function** | `20260313135722_fix_...sql` | 5-65 | Two-stage: word_similarity filter + GREATEST ranking |
| **Vector SQL function** | `20260228155119_pgvector...sql` | 53-80 | Cosine distance, similarity = 1 - distance |
| **Assembly join key** | `assembly.ts` | 125, 134 | ingredientName ONLY (BUG) |
| **Last-write-wins bug** | `assembly.ts` | 122-127 | Same ingredient in multiple meal items overwrites |
| **Unmatched XML** | `nutrition.ts` | 79-94 | No mealContext link to meal item |
| **Unmatched rule** | `nutrition.ts` | 135-139 | Wider bounds (−15%, +25%) but no context |
| **IngredientLlmNutrition** | `types.ts` | 148-154 | NO mealItemName field |
| **MealItemNutrition** | `types.ts` | 157-160 | Has mealItemName but ingredient doesn't |
| **ProcessedIngredient** | `types.ts` | 171-182 | NO mealItemName field (decontextualized) |
| **Unmatched context** | `types.ts` | 138-141 | mealContext = raw user input (not meal item name) |

