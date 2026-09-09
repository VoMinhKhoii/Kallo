// The composer's picks, resolved to frozen meal items.
//
// ONE place turns a `{kind}` reference into nutrition, so the two paths that
// accept picks cannot disagree about what one is worth: the combined merge
// behind `/api/analyze-meal` (free text + picks) and `stageRelogAnalysisAction`
// (picks alone). Both used to call `resolveRelogSources` directly, which only
// knows how to reach a past meal — a scanned product needs the barcode cache.
//
// Tenant isolation is unchanged: relog refs go through `resolveRelogSources`,
// which re-asserts `WHERE user_id = …`. A barcode ref carries no user-scoped
// id at all — the cache is a shared product table, and the only thing a client
// can do by naming one is log a product it could equally have scanned.
import { resolveRelogSources } from '@/lib/actions/meals/relog/resolve-sources';
import type { MealConfidence, PipelineMealItem } from '@/lib/ai/types/result';
import { Errors } from '@/lib/core/errors/catalog';
import { findCachedRow } from '@/lib/domain/barcode/cache';
import { buildBarcodeMealItem } from '@/lib/domain/barcode/meal-item';
import {
  buildFrozenMealItem,
  toMealConfidence,
} from '@/lib/domain/logging/relog/build-relog-pipeline-result';
import {
  barcodeRefsOf,
  type ComposerPickRef,
  relogRefsOf,
  weakestConfidence,
} from '@/lib/domain/logging/relog/relog';
import { db } from '@/lib/infra/db/client';

export interface ResolvedPicks {
  /** Frozen items, relogged dishes first and scanned products after them.
   *  Positional order becomes confirm's `mealItemOrder`. */
  items: PipelineMealItem[];
  /** Display names, positionally aligned with {@link items}. */
  names: string[];
  /**
   * What this basket of picks is worth: the weakest confidence across the
   * source MEALS it copies from, or 'high' when it copies from none.
   *
   * A printed label is not an estimate. Falling through to the 'low' default
   * would have made a scanned product read less certain through the composer
   * than the same scan does through `stageBarcodeMeal`, which calls it 'high'
   * — one product, two answers.
   */
  confidence: MealConfidence;
}

/**
 * Resolve every pick a submit carried.
 *
 * The relog half runs inside a short transaction holding `FOR UPDATE` on the
 * source meals, for the reason `resolveRelogSources` documents: a concurrent
 * split-share could otherwise halve a source's rows between the eligibility
 * check and the read. The barcode half is a plain cache read and deliberately
 * runs OUTSIDE that transaction — the pool is two connections deep, and a
 * lookup that needs no lock must not hold one open.
 */
export async function resolveComposerPicks(
  userId: string,
  refs: ComposerPickRef[]
): Promise<ResolvedPicks> {
  const relogRefs = relogRefsOf(refs);
  const barcodeRefs = barcodeRefsOf(refs);

  const scanned = await Promise.all(
    barcodeRefs.map(async (ref) => {
      const row = await findCachedRow(ref.barcode);
      // The cache is what a SEARCH fills, so a barcode with no row was never
      // looked up — the client has to scan it again rather than have this
      // endpoint quietly reach out to a provider mid-analysis.
      if (!row) {
        throw Errors.validationFailed(
          'Không tìm thấy sản phẩm đã quét. Hãy quét lại.'
        );
      }
      return buildBarcodeMealItem(row, ref.grams).item;
    })
  );

  if (relogRefs.length === 0) {
    return {
      items: scanned,
      names: scanned.map((item) => item.name),
      confidence: 'high',
    };
  }

  const { dishes, sourceConfidences } = await db.transaction((tx) =>
    resolveRelogSources(tx, userId, relogRefs, { lock: true })
  );
  const relogged = dishes.map((dish) => buildFrozenMealItem(dish));

  return {
    items: [...relogged, ...scanned],
    names: [
      ...dishes.map((dish) => dish.name),
      ...scanned.map((item) => item.name),
    ],
    confidence: toMealConfidence(weakestConfidence(sourceConfidences)),
  };
}
