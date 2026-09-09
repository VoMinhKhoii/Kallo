import type { PipelineResult } from '@/lib/ai/types/result';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import {
  cacheBarcodeProduct,
  findCachedRow,
  getBarcodeSourceIds,
  rowToProduct,
} from '@/lib/domain/barcode/cache';
import { resolveBarcodeProduct } from '@/lib/domain/barcode/chain';
import { BarcodeServiceError } from '@/lib/domain/barcode/errors';
import { buildBarcodeMealItem } from '@/lib/domain/barcode/meal-item';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import { db } from '@/lib/infra/db/client';
import { pendingAnalyses } from '@/lib/infra/db/schema';

// Re-exported from its dependency-light home so every existing importer keeps
// one path; `errors.ts` holds it so a caller that only classifies a failure
// need not pull this module's DB and provider-chain imports in behind it.
export { BarcodeServiceError } from '@/lib/domain/barcode/errors';

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

  // Resolved BEFORE the chain, not in parallel with it: a provider whose seed
  // row is missing must be skipped rather than allowed to win and then fail.
  // The lost parallelism is noise — one indexed local query against 4–8s of
  // external provider fetches.
  const sourceIds = await getBarcodeSourceIds();

  const resolved = await resolveBarcodeProduct(barcode, {
    seededSourceCodes: new Set(sourceIds.keys()),
  });

  if (!resolved) {
    throw new BarcodeServiceError('not_found');
  }

  // Defensive backstop, effectively unreachable: the chain was already handed
  // the seeded codes and skips any provider missing from them. Kept so a future
  // caller that omits `seededSourceCodes` still fails loudly rather than
  // silently mislabeling provenance with an arbitrary fallback id.
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

  const loggedAt = getUtcInstantForLocalDate(
    input.loggedDate,
    input.timezoneOffset
  );

  // 2. The same frozen item a composer barcode PICK produces — one builder, so
  //    scanning a carton and scanning it mid-sentence can never disagree.
  const { item, nutrition } = buildBarcodeMealItem(dbProduct, input.grams);
  const pipelineResult: PipelineResult = {
    mealSlot: null,
    confidenceOverall: 'high',
    unmatchedIngredients: [],
    displayedNutrition: nutrition,
    boundedNutrition: item.boundedNutrition,
    mealItems: [item],
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
