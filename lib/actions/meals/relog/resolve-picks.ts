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
import { findCachedRows } from '@/lib/domain/barcode/cache';
import {
  BARCODE_RESCAN_MESSAGE,
  BarcodeServiceError,
  mapBarcodeServiceError,
} from '@/lib/domain/barcode/errors';
import { buildBarcodeMealItem } from '@/lib/domain/barcode/meal-item';
import {
  buildFrozenMealItem,
  toMealConfidence,
} from '@/lib/domain/logging/relog/build-relog-pipeline-result';
import type {
  BarcodeRef,
  ComposerPickRef,
  RelogRef,
} from '@/lib/domain/logging/relog/relog';
import { weakestConfidence } from '@/lib/domain/logging/relog/relog';
import { db } from '@/lib/infra/db/client';

export interface ResolvedPicks {
  /** Frozen items in the order the picks were STAGED — a scanned product sits
   *  where the user put it, not after every relogged dish. Positional order
   *  becomes confirm's `mealItemOrder`. */
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

/** One output slot per ORIGINAL ref. A `meal` ref fills its slot with several
 *  dishes, which is what keeps a meal's dishes contiguous when the slots are
 *  flattened back into one list. */
interface PickSlot {
  items: PipelineMealItem[];
  names: string[];
}

/**
 * The cache is what a SEARCH fills, so a barcode with no row was never looked
 * up — the client has to scan it again rather than have this endpoint quietly
 * reach out to a provider mid-analysis.
 *
 * Thrown pre-mapped as the `/api/v1` `BARCODE_NOT_CACHED` envelope: the one
 * value then reads correctly on all three transports this resolver feeds — a
 * 404 through `handleRouteError`, a 404 through `serializeError`, and a
 * `barcode_not_cached` SSE frame through `toStreamErrorEvent`, which only
 * understands `AppError` and would otherwise flatten it to a generic
 * "Failed to process meal".
 */
function notCached(): unknown {
  return mapBarcodeServiceError(
    new BarcodeServiceError('not_cached', BARCODE_RESCAN_MESSAGE)
  );
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
  const slots: PickSlot[] = refs.map(() => ({ items: [], names: [] }));

  // Original positions, so both halves can be written back into the order the
  // user staged them.
  const barcodeIndices: number[] = [];
  const relogIndices: number[] = [];
  for (const [index, ref] of refs.entries()) {
    if (ref.kind === 'barcode') barcodeIndices.push(index);
    else relogIndices.push(index);
  }

  // ONE query for every scanned pick, deduped: 20 picks were 20 sequential
  // round trips against a two-connection pool.
  const cached = await findCachedRows(
    barcodeIndices.map((index) => (refs[index] as BarcodeRef).barcode)
  );
  for (const index of barcodeIndices) {
    const ref = refs[index] as BarcodeRef;
    const row = cached.get(ref.barcode);
    if (!row) throw notCached();
    const { item } = buildBarcodeMealItem(row, ref.grams);
    slots[index].items.push(item);
    slots[index].names.push(item.name);
  }

  const flatten = (confidence: MealConfidence): ResolvedPicks => ({
    items: slots.flatMap((slot) => slot.items),
    names: slots.flatMap((slot) => slot.names),
    confidence,
  });

  if (relogIndices.length === 0) return flatten('high');

  const { dishes, sourceConfidences } = await db.transaction((tx) =>
    resolveRelogSources(
      tx,
      userId,
      relogIndices.map((index) => refs[index] as RelogRef),
      { lock: true }
    )
  );
  // `refIndex` is the dish's position in the RELOG-only list handed to the
  // resolver, so map it back through `relogIndices` to the original ref.
  for (const dish of dishes) {
    const slot = slots[relogIndices[dish.refIndex]];
    slot.items.push(buildFrozenMealItem(dish));
    slot.names.push(dish.name);
  }

  return flatten(toMealConfidence(weakestConfidence(sourceConfidences)));
}
