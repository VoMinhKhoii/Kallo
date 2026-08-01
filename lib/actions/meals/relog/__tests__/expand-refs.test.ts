import { describe, expect, it } from 'vitest';
import {
  RelogResolutionError,
  resolveRelogDishes,
  type SourceItemRow,
} from '@/lib/actions/meals/relog/expand-refs';
import { RELOG_MAX_DISHES, type RelogRef } from '@/lib/logging/relog/relog';

const MEAL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEAL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface Row extends SourceItemRow {
  ingredientName: string;
}

const row = (
  mealId: string,
  order: number,
  dish: string,
  ingredient: string
): Row => ({
  mealId,
  mealItemOrder: order,
  mealItemName: dish,
  ingredientName: ingredient,
});

// Meal A: two dishes. Meal B: one dish that is ALSO called "Phở bò", at its own
// order 0 — the collision that makes re-sequencing mandatory downstream.
const ROWS: Row[] = [
  row(MEAL_A, 0, 'Phở bò', 'bánh phở'),
  row(MEAL_A, 0, 'Phở bò', 'thịt bò'),
  row(MEAL_A, 1, 'Trà đá', 'trà'),
  row(MEAL_B, 0, 'Phở bò', 'bánh phở'),
];

const dishRef = (mealId: string, order: number): RelogRef => ({
  kind: 'dish',
  sourceMealId: mealId,
  mealItemOrder: order,
});
const mealRef = (mealId: string): RelogRef => ({
  kind: 'meal',
  sourceMealId: mealId,
});

const shape = (dishes: ReturnType<typeof resolveRelogDishes<Row>>) =>
  dishes.map((d) => ({
    name: d.name,
    ingredients: d.rows.map((r) => r.ingredientName),
  }));

describe('resolveRelogDishes', () => {
  it('resolves a dish ref to exactly its own ingredient rows', () => {
    expect(shape(resolveRelogDishes([dishRef(MEAL_A, 0)], ROWS))).toEqual([
      { name: 'Phở bò', ingredients: ['bánh phở', 'thịt bò'] },
    ]);
  });

  it('does not bleed sibling dishes from the same meal into a dish ref', () => {
    const [dish] = resolveRelogDishes([dishRef(MEAL_A, 1)], ROWS);
    expect(dish.name).toBe('Trà đá');
    expect(dish.rows).toHaveLength(1);
  });

  it('expands a meal ref to every dish of that meal, in the meal’s order', () => {
    expect(shape(resolveRelogDishes([mealRef(MEAL_A)], ROWS))).toEqual([
      { name: 'Phở bò', ingredients: ['bánh phở', 'thịt bò'] },
      { name: 'Trà đá', ingredients: ['trà'] },
    ]);
  });

  it('preserves the order the user staged them', () => {
    const resolved = resolveRelogDishes(
      [dishRef(MEAL_A, 1), mealRef(MEAL_B), dishRef(MEAL_A, 0)],
      ROWS
    );
    expect(resolved.map((d) => d.name)).toEqual(['Trà đá', 'Phở bò', 'Phở bò']);
  });

  it('keeps duplicate picks of the same dish as separate dishes', () => {
    // Two bowls is a real meal; collapsing them would halve what was logged.
    const resolved = resolveRelogDishes(
      [dishRef(MEAL_A, 0), dishRef(MEAL_A, 0)],
      ROWS
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0].rows).toHaveLength(2);
    expect(resolved[1].rows).toHaveLength(2);
  });

  it('copies a dish twice when a meal and a dish it contains are both staged', () => {
    const resolved = resolveRelogDishes(
      [mealRef(MEAL_A), dishRef(MEAL_A, 0)],
      ROWS
    );
    expect(resolved.map((d) => d.name)).toEqual(['Phở bò', 'Trà đá', 'Phở bò']);
  });

  it('keeps same-named dishes from different meals distinct', () => {
    const resolved = resolveRelogDishes(
      [dishRef(MEAL_A, 0), dishRef(MEAL_B, 0)],
      ROWS
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0].rows).toHaveLength(2);
    expect(resolved[1].rows).toHaveLength(1);
  });

  it('throws when a dish ref no longer resolves', () => {
    expect(() => resolveRelogDishes([dishRef(MEAL_A, 9)], ROWS)).toThrow(
      RelogResolutionError
    );
  });

  it('throws when a meal ref has no surviving rows', () => {
    expect(() => resolveRelogDishes([mealRef(MEAL_A)], [])).toThrow(
      RelogResolutionError
    );
  });

  it('copies the survivors when a meal was only partly deleted', () => {
    // A meal ref asked for "that meal", so whatever remains is a faithful
    // answer — unlike a dish ref, which named one specific thing.
    const partial = ROWS.filter((r) => r.mealItemName !== 'Trà đá');
    expect(shape(resolveRelogDishes([mealRef(MEAL_A)], partial))).toEqual([
      { name: 'Phở bò', ingredients: ['bánh phở', 'thịt bò'] },
    ]);
  });

  it('throws rather than truncating past the dish cap', () => {
    const many: Row[] = Array.from({ length: RELOG_MAX_DISHES + 1 }, (_, i) =>
      row(MEAL_A, i, `Món ${i}`, 'x')
    );
    expect(() => resolveRelogDishes([mealRef(MEAL_A)], many)).toThrow(
      /quá 30 món/
    );
  });

  it('allows exactly the dish cap', () => {
    const many: Row[] = Array.from({ length: RELOG_MAX_DISHES }, (_, i) =>
      row(MEAL_A, i, `Món ${i}`, 'x')
    );
    expect(resolveRelogDishes([mealRef(MEAL_A)], many)).toHaveLength(
      RELOG_MAX_DISHES
    );
  });

  it('throws on an empty ref list rather than writing an item-less meal', () => {
    // A meal with no items reads as a cheat meal downstream and renders as a
    // 0-kcal ghost card.
    expect(() => resolveRelogDishes([], ROWS)).toThrow(RelogResolutionError);
  });
});
