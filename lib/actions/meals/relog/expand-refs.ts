// Pure resolution step for the relog writer: turn the client's references into
// an ordered, flat list of dishes with their source ingredient rows. Kept out of
// relog-items.ts (a 'use server' transaction writer) so the tricky part — meal
// expansion, ordering and the missing-ref rules — is testable on plain data.
import { RELOG_MAX_DISHES, type RelogRef } from '@/lib/logging/relog/relog';

/** The subset of a `meal_items` row this step needs to group and order. */
export interface SourceItemRow {
  mealId: string;
  mealItemName: string;
  mealItemOrder: number;
}

/** One dish to copy: its label plus the source rows that compose it, in the
 *  order they should be written. */
export interface ResolvedDish<T extends SourceItemRow> {
  name: string;
  rows: T[];
}

export class RelogResolutionError extends Error {}

function groupKey(row: SourceItemRow): string {
  return `${row.mealId}:${row.mealItemOrder}`;
}

/**
 * Resolve refs to dishes, preserving the order the user staged them.
 *
 * A `dish` ref contributes exactly the rows at its `(mealId, mealItemOrder)`;
 * a `meal` ref expands to every distinct dish of that meal, in the meal's own
 * order. Expansion happens here, before the writer re-sequences, so everything
 * downstream sees one flat dish list and never asks where a dish came from.
 *
 * `rows` must already be scoped to meals proven to belong to the caller and
 * sorted by (meal_item_order, created_at, id) — this function does no
 * authorization and no sorting of its own.
 *
 * Missing refs are fatal rather than skipped: a relog that silently drops a
 * dish would write a meal the user did not ask for. A `dish` ref is the
 * stricter of the two — it named one specific thing, so its exact group must
 * still exist — while a `meal` ref copies whatever dishes survive and only
 * fails when the meal has nothing left at all.
 */
export function resolveRelogDishes<T extends SourceItemRow>(
  refs: RelogRef[],
  rows: T[]
): ResolvedDish<T>[] {
  const byDish = new Map<string, T[]>();
  const dishOrderByMeal = new Map<string, string[]>();
  for (const row of rows) {
    const key = groupKey(row);
    const existing = byDish.get(key);
    if (existing) {
      existing.push(row);
      continue;
    }
    byDish.set(key, [row]);
    const order = dishOrderByMeal.get(row.mealId);
    if (order) order.push(key);
    else dishOrderByMeal.set(row.mealId, [key]);
  }

  const resolved: ResolvedDish<T>[] = [];
  for (const ref of refs) {
    if (ref.kind === 'dish') {
      const key = `${ref.sourceMealId}:${ref.mealItemOrder}`;
      const group = byDish.get(key);
      if (!group || group.length === 0) {
        throw new RelogResolutionError(
          'Món ăn không còn trong lịch sử. Hãy bỏ món đó rồi thử lại.'
        );
      }
      resolved.push({ name: group[0].mealItemName, rows: group });
      continue;
    }
    const keys = dishOrderByMeal.get(ref.sourceMealId) ?? [];
    if (keys.length === 0) {
      throw new RelogResolutionError(
        'Bữa ăn không còn trong lịch sử. Hãy bỏ bữa đó rồi thử lại.'
      );
    }
    for (const key of keys) {
      const group = byDish.get(key) as T[];
      resolved.push({ name: group[0].mealItemName, rows: group });
    }
  }

  // A meal ref expands to many dishes, so the staged-entry cap in the contract
  // does not bound this. Refuse rather than truncate — silently dropping the
  // tail of a meal is exactly the kind of quiet wrongness relog exists to avoid.
  if (resolved.length > RELOG_MAX_DISHES) {
    throw new RelogResolutionError(
      `Không thể ghi lại quá ${RELOG_MAX_DISHES} món trong một bữa.`
    );
  }
  // Defence in depth: a zero-item meal would read as a cheat meal downstream
  // and render as a 0-kcal ghost card.
  if (resolved.length === 0) {
    throw new RelogResolutionError('Không có món nào để ghi lại.');
  }
  return resolved;
}
