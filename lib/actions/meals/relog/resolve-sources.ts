// Shared authorization + resolution seam for relog. Both the direct writer
// (`relogMealItemsAction`) and the staging paths (`stageRelogAnalysisAction`,
// the mixed `/api/analyze-meal` merge) call this so the security re-assertions
// live in exactly one place: a stale or hand-crafted reference can never reach
// a source the picker would not offer.
//
// Tenant isolation: Drizzle runs on the owner connection and BYPASSES RLS, so
// the explicit `user_id` predicate here is the real boundary. Item rows are
// reached only through meal ids that predicate already proved.
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  RelogResolutionError,
  type ResolvedDish,
  resolveRelogDishes,
} from '@/lib/actions/meals/relog/expand-refs';
import type { AppDb, AppTransaction } from '@/lib/db';
import { mealItems, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import type { RelogRef } from '@/lib/logging/relog/relog';

type Executor = AppDb | AppTransaction;

/** The resolved dishes (source rows, in write order) plus the confidence of
 *  each contributing source meal, so callers can compute the weakest. */
export interface ResolvedRelogSources {
  dishes: ResolvedDish<Awaited<ReturnType<typeof selectSourceRows>>[number]>[];
  sourceConfidences: (string | null)[];
}

function selectSourceRows(executor: Executor, sourceIds: string[]) {
  return (
    executor
      .select()
      .from(mealItems)
      .where(inArray(mealItems.mealId, sourceIds))
      // Deterministic intra-dish order: loadMealsByDate selects without an
      // ORDER BY, so this is not inherited and must be stated here.
      .orderBy(
        asc(mealItems.mealItemOrder),
        asc(mealItems.createdAt),
        asc(mealItems.id)
      )
  );
}

/**
 * Resolve relog references to an ordered dish list, re-asserting ownership and
 * the picker's candidacy rules.
 *
 * `opts.lock` takes `FOR UPDATE` on the source meals so nothing can land
 * between the eligibility re-check below and the row read that follows it in
 * the SAME transaction. Set it only when called inside `db.transaction` — which
 * is what ALL THREE callers do: the direct writer (`relogMealItemsAction`), the
 * pure-relog staging path (`stageRelogAnalysisAction`) and the combined merge
 * (`applyRelogRefs`).
 *
 * The staging paths need it as much as the writer does, which is why they take
 * it: without the lock a concurrent split-share could halve a source's
 * `meal_items` and set `portion_factor < 1` between the check and the read, and
 * the halved rows would be snapshotted under the full dish name. They may
 * commit before their pending row is written — by then the numbers are frozen
 * in memory and nothing after commit can change them.
 */
export async function resolveRelogSources(
  executor: Executor,
  userId: string,
  refs: RelogRef[],
  opts: { lock?: boolean } = {}
): Promise<ResolvedRelogSources> {
  const sourceIds = [...new Set(refs.map((ref) => ref.sourceMealId))];

  const sourceMealsQuery = executor
    .select({
      id: meals.id,
      entryMode: meals.entryMode,
      portionFactor: meals.portionFactor,
      confidenceOverall: meals.confidenceOverall,
    })
    .from(meals)
    .where(and(eq(meals.userId, userId), inArray(meals.id, sourceIds)));
  const sourceMeals = opts.lock
    ? await sourceMealsQuery.for('update')
    : await sourceMealsQuery;

  if (sourceMeals.length !== sourceIds.length) {
    throw Errors.validationFailed(
      'Món ăn không tồn tại hoặc không thuộc về bạn.'
    );
  }
  // Re-assert what the candidate query already filtered on.
  for (const source of sourceMeals) {
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể ghi lại bữa xả theo cách này.');
    }
    // A split share's rows are ALREADY halved, so copying them verbatim under
    // the full dish name would log half a portion as a whole one.
    if (Number(source.portionFactor) !== 1) {
      throw Errors.validationFailed(
        'Không thể ghi lại món đã chia đôi. Hãy ghi lại cả bữa.'
      );
    }
  }

  const sourceRows = await selectSourceRows(executor, sourceIds);

  let dishes: ResolvedRelogSources['dishes'];
  try {
    dishes = resolveRelogDishes(refs, sourceRows);
  } catch (error) {
    if (error instanceof RelogResolutionError) {
      throw Errors.validationFailed(error.message);
    }
    throw error;
  }

  return {
    dishes,
    sourceConfidences: sourceMeals.map((m) => m.confidenceOverall),
  };
}
