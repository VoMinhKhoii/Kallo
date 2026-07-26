import { extractNutritionValues } from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type {
  BoundedNutrition,
  NutritionValues,
  PipelineResult,
} from '@/lib/ai/types';
import {
  cacheBarcodeProduct,
  findCachedRow,
  getBarcodeSourceIds,
  rowToProduct,
} from '@/lib/barcode/cache';
import { resolveBarcodeProduct } from '@/lib/barcode/chain';
import type {
  BarcodeErrorCode,
  ParsedBarcodeProduct,
} from '@/lib/barcode/types';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';

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
 * cache first; on a miss runs the provider chain and caches the winner in
 * `vietnamese_food_composition` under the resolving provider's prefixed id.
 *
 * @throws BarcodeServiceError `not_found` when no provider returns a usable
 *   product; `server_error` when that provider's seeded `ingredient_sources`
 *   row is missing.
 */
export async function searchBarcodeProduct(
  barcode: string
): Promise<ParsedBarcodeProduct> {
  const cached = await findCachedRow(barcode);
  if (cached) {
    return rowToProduct(barcode, cached);
  }

  // Run the chain and resolve every provider's source id in parallel — the
  // source lookup is independent of the (slow, external) provider fetches, and
  // which one is needed is only known once the chain resolves.
  const [resolved, sourceIds] = await Promise.all([
    resolveBarcodeProduct(barcode),
    getBarcodeSourceIds(),
  ]);

  if (!resolved) {
    throw new BarcodeServiceError('not_found');
  }

  // Ingredient sources are seeded by migration; an absent row is a server
  // misconfiguration, not a user error. Fail loudly rather than silently
  // mislabeling provenance with an arbitrary fallback id.
  const sourceId = sourceIds.get(resolved.provider.sourceCode);
  if (sourceId === undefined) {
    console.error(
      `Missing '${resolved.provider.sourceCode}' ingredient source — cannot cache barcode product`
    );
    throw new BarcodeServiceError('server_error');
  }

  await cacheBarcodeProduct({
    providerId: resolved.provider.id,
    barcode,
    product: resolved.product,
    sourceId,
  });

  return resolved.product;
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
  // 1. Get the cached product from whichever provider resolved this barcode.
  const dbProduct = await findCachedRow(input.barcode);

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
