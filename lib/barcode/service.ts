import { eq } from 'drizzle-orm';
import { extractNutritionValues } from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type {
  BoundedNutrition,
  NutritionValues,
  PipelineResult,
} from '@/lib/ai/types';
import {
  fetchProductFromOpenFoodFacts,
  type ParsedBarcodeProduct,
  parseSizeGrams,
} from '@/lib/barcode/openfoodfacts';
import type { BarcodeErrorCode } from '@/lib/barcode/types';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import {
  ingredientSources,
  pendingAnalyses,
  vietnameseFoodComposition,
} from '@/lib/db/schema';

/**
 * Domain failure in the barcode flow, carrying a stable {@link BarcodeErrorCode}.
 *
 * The service THROWS instead of returning `{success:false}` unions so that
 * callers choose their own error transport: server actions catch and fold into
 * their result union (web dialog contract), while `/api/v1/barcode/*` routes
 * map codes onto the standard `{error:{code,status,...}}` envelope with real
 * HTTP statuses. Crucially this keeps auth/validation failures OUT of the
 * domain-error path — an expired mobile token must surface as a 401, not as a
 * `server_error` inside an HTTP 200.
 */
export class BarcodeServiceError extends Error {
  constructor(
    public readonly code: Exclude<BarcodeErrorCode, 'invalid_input'>,
    message?: string
  ) {
    super(message ?? `Barcode flow failed: ${code}`);
    this.name = 'BarcodeServiceError';
  }
}

function scaleNutrition(
  nutrition: NutritionValues,
  factor: number
): NutritionValues {
  const scaled = {} as NutritionValues;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    scaled[key] = val !== null ? Number((val * factor).toFixed(2)) : null;
  }
  return scaled;
}

function buildBoundedNutrition(nutrition: NutritionValues): BoundedNutrition {
  const bounded = {} as BoundedNutrition;
  for (const key of NUTRITION_KEYS) {
    const val = nutrition[key];
    bounded[key] = val !== null ? { low: val, mid: val, high: val } : null;
  }
  return bounded;
}

/**
 * Look up a product by (digits-only, pre-validated) barcode. Checks the local
 * cache first; on a miss fetches from Open Food Facts and caches the result in
 * `vietnamese_food_composition` under id `off_<barcode>`.
 *
 * @throws BarcodeServiceError `not_found` when OFF has no such product;
 *   `server_error` when the seeded 'OFF' ingredient source row is missing.
 */
export async function searchBarcodeProduct(
  barcode: string
): Promise<ParsedBarcodeProduct> {
  const dbId = `off_${barcode}`;

  // 1. Check local cache
  const [cached] = await db
    .select()
    .from(vietnameseFoodComposition)
    .where(eq(vietnameseFoodComposition.id, dbId))
    .limit(1);

  if (cached) {
    // Parse brand and name from primary name e.g. "[Coca-Cola] Original Taste"
    let brand: string | null = null;
    let name = cached.namePrimary;
    const brandMatch = cached.namePrimary.match(/^\[(.*?)\]\s*(.*)$/);
    if (brandMatch) {
      brand = brandMatch[1];
      name = brandMatch[2];
    }

    const nutrition = extractNutritionValues(cached);

    return {
      barcode,
      name,
      brand,
      caloriesKcal: nutrition.caloriesKcal,
      proteinG: nutrition.proteinG,
      carbohydrateG: nutrition.carbohydrateG,
      fatG: nutrition.fatG,
      fiberG: nutrition.fiberG,
      sodiumMg: nutrition.sodiumMg,
      // numeric columns surface as strings; run through the same sizing
      // validation as ingestion so cache reads apply the identical
      // positivity + 100kg-cap invariant (single source of truth).
      servingSizeG: parseSizeGrams(cached.servingSizeG),
      packageSizeG: parseSizeGrams(cached.packageSizeG),
    };
  }

  // 2. Fetch from Open Food Facts and resolve the OFF source id in parallel —
  // the source lookup is independent of the product fetch, so there's no
  // reason to wait for the (slow, external) fetch before starting it.
  const [product, sourceRow] = await Promise.all([
    fetchProductFromOpenFoodFacts(barcode),
    db
      .select({ id: ingredientSources.id })
      .from(ingredientSources)
      .where(eq(ingredientSources.code, 'OFF'))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!product) {
    throw new BarcodeServiceError('not_found');
  }

  // The 'OFF' ingredient source is seeded by migration; its absence is a
  // server misconfiguration, not a user error. Fail loudly rather than
  // silently mislabeling provenance with an arbitrary fallback id.
  if (!sourceRow) {
    console.error(
      "Missing 'OFF' ingredient source — cannot cache barcode product"
    );
    throw new BarcodeServiceError('server_error');
  }

  // 3. Cache in Database
  const sourceId = sourceRow.id;
  const namePrimary = product.brand
    ? `[${product.brand}] ${product.name}`
    : product.name;

  // onConflictDoNothing: two concurrent first-time scans of the same barcode
  // would otherwise race on the primary key; the loser is harmlessly ignored.
  await db
    .insert(vietnameseFoodComposition)
    .values({
      id: dbId,
      namePrimary,
      nameEn: product.name,
      typeVn: 'Sản phẩm đóng gói',
      typeEn: 'Packaged product',
      sourceId,
      state: 'cooked',
      servingSizeG:
        product.servingSizeG !== null ? String(product.servingSizeG) : null,
      packageSizeG:
        product.packageSizeG !== null ? String(product.packageSizeG) : null,
      caloriesKcal:
        product.caloriesKcal !== null ? String(product.caloriesKcal) : null,
      proteinG: product.proteinG !== null ? String(product.proteinG) : null,
      carbohydrateG:
        product.carbohydrateG !== null ? String(product.carbohydrateG) : null,
      fatG: product.fatG !== null ? String(product.fatG) : null,
      fiberG: product.fiberG !== null ? String(product.fiberG) : null,
      sodiumMg: product.sodiumMg !== null ? String(product.sodiumMg) : null,
      searchText: namePrimary.toLowerCase(),
      searchTextAscii: namePrimary.toLowerCase(),
    })
    .onConflictDoNothing({ target: vietnameseFoodComposition.id });

  return product;
}

/**
 * Scale the cached product's per-100g nutrition to `grams` and stage it in
 * `pending_analyses` as a high-confidence, precise-entry {@link PipelineResult}.
 *
 * @throws BarcodeServiceError `not_cached` when the barcode was never searched
 *   (no cache row to stage from); `stage_failed` when the insert returns
 *   nothing.
 */
export async function stageBarcodeMeal(
  userId: string,
  input: {
    barcode: string;
    grams: number;
    loggedDate: string;
    timezoneOffset: number;
  }
): Promise<{ analysisId: string }> {
  const dbId = `off_${input.barcode}`;

  // 1. Get cached product
  const [dbProduct] = await db
    .select()
    .from(vietnameseFoodComposition)
    .where(eq(vietnameseFoodComposition.id, dbId))
    .limit(1);

  if (!dbProduct) {
    throw new BarcodeServiceError('not_cached');
  }

  const nutrition = extractNutritionValues(dbProduct);
  const scaledNutrition = scaleNutrition(nutrition, input.grams / 100);
  const boundedNutrition = buildBoundedNutrition(scaledNutrition);

  const loggedAt = getUtcInstantForLocalDate(
    input.loggedDate,
    input.timezoneOffset
  );

  // 2. Build PipelineResult object mimicking natural language decomposition output
  const pipelineResult: PipelineResult = {
    mealSlot: null,
    confidenceOverall: 'high',
    unmatchedIngredients: [],
    displayedNutrition: scaledNutrition,
    boundedNutrition: boundedNutrition,
    mealItems: [
      {
        name: dbProduct.namePrimary,
        displayedNutrition: scaledNutrition,
        boundedNutrition: boundedNutrition,
        ingredients: [
          {
            ingredientName: dbProduct.namePrimary,
            foodCompositionId: dbProduct.id,
            estimatedGrams: input.grams,
            rawEquivalentGrams: input.grams,
            cookingMethod: null,
            userFacingUnit: 'g',
            matchConfidence: 1,
            boundedNutrition: boundedNutrition,
            displayedNutrition: scaledNutrition,
          },
        ],
      },
    ],
  };

  // 3. Insert into pending_analyses
  const [inserted] = await db
    .insert(pendingAnalyses)
    .values({
      userId,
      pipelineResult,
      rawInput: `${dbProduct.namePrimary} (${input.grams}g)`,
      entryMode: 'precise',
      loggedAt,
    })
    .returning({ id: pendingAnalyses.id });

  if (!inserted) {
    throw new BarcodeServiceError('stage_failed');
  }

  return { analysisId: inserted.id };
}
