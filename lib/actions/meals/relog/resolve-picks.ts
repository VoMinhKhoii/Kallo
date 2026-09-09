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
import { barcodeNotCachedError } from '@/lib/domain/barcode/errors';
import { buildBarcodeMealItem } from '@/lib/domain/barcode/meal-item';
import {
  buildFrozenMealItem,
  toMealConfidence,
} from '@/lib/domain/logging/relog/build-pick-pipeline-result';
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

  // Original positions carried alongside the narrowed ref, so both halves can
  // be written back into the order the user staged them without re-reading
  // `refs` through a cast.
  const barcodePicks: { index: number; ref: BarcodeRef }[] = [];
  const relogPicks: { index: number; ref: RelogRef }[] = [];
  for (const [index, ref] of refs.entries()) {
    if (ref.kind === 'barcode') barcodePicks.push({ index, ref });
    else relogPicks.push({ index, ref });
  }

  // ONE query for every scanned pick, deduped: 20 picks were 20 sequential
  // round trips against a two-connection pool.
  const cached = await findCachedRows(
    barcodePicks.map(({ ref }) => ref.barcode)
  );
  for (const { index, ref } of barcodePicks) {
    const row = cached.get(ref.barcode);
    // A barcode with no cache row was never SEARCHED, and this resolver must
    // not quietly reach out to a provider mid-analysis — the client rescans.
    if (!row) throw barcodeNotCachedError();
    const { item } = buildBarcodeMealItem(row, ref.grams);
    slots[index].items.push(item);
    slots[index].names.push(item.name);
  }

  const flatten = (confidence: MealConfidence): ResolvedPicks => ({
    items: slots.flatMap((slot) => slot.items),
    names: slots.flatMap((slot) => slot.names),
    confidence,
  });

  if (relogPicks.length === 0) return flatten('high');

  const { dishes, sourceConfidences } = await db.transaction((tx) =>
    resolveRelogSources(
      tx,
      userId,
      relogPicks.map(({ ref }) => ref),
      { lock: true }
    )
  );
  // `refIndex` is the dish's position in the RELOG-only list handed to the
  // resolver, so map it back through `relogPicks` to the original ref.
  for (const dish of dishes) {
    const slot = slots[relogPicks[dish.refIndex].index];
    slot.items.push(buildFrozenMealItem(dish));
    slot.names.push(dish.name);
  }

  return flatten(toMealConfidence(weakestConfidence(sourceConfidences)));
}
