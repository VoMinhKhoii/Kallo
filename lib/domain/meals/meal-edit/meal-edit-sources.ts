/**
 * Into and out of a {@link MealEditDraft}, for each life of a meal.
 *
 * A saved meal comes in as its ingredient rows grouped into dishes and goes
 * back out as per-row gram overrides plus removals — the payload
 * `updateMealAction` already takes. An unsaved meal comes in as its staged
 * items and goes back as those items re-scaled, which the card's confirm then
 * sends. Dart twin: `meal_edit_sources.dart`.
 */
import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import type { MealItem } from '@/lib/core/types/meal';
import {
  atGrams,
  type EditDish,
  findDish,
  type MealEditDraft,
  originalGrams,
  partScales,
  servingsOf,
  sumTotals,
} from './meal-edit-draft';

export interface PersistedMealEdit {
  edits: { id: string; newGrams: number }[];
  removeIds: string[];
}

/** A saved meal's dishes, in the order the card lists them. */
export function draftFromPersisted(meal: PersistedMeal): MealEditDraft {
  const groups = [...meal.mealItemGroups].sort((a, b) => a.order - b.order);
  return { canRemove: true, whole: 1, dishes: groups.map(persistedDish) };
}

function persistedDish(group: PersistedMealItemGroup): EditDish {
  const weighed = group.ingredients.filter((i) => (i.estimatedGrams ?? 0) > 0);
  // Exactly as logged — no floor applied on the way in, so an untouched dialog
  // saves nothing and shows what the card shows.
  const logged = group.ingredients.reduce(
    (sum, i) => sum + Math.max(0, i.estimatedGrams ?? 0),
    0
  );
  return {
    key: String(group.order),
    name: group.name,
    // A drink logged in millilitres reads in ml; anything mixed in grams.
    unit:
      weighed.length > 0 && weighed.every((i) => i.userFacingUnit === 'ml')
        ? 'ml'
        : 'g',
    grams: logged,
    parts: group.ingredients.map((i) => ({
      id: i.id,
      grams: i.estimatedGrams,
      kcal: i.nutrition.caloriesKcal,
      protein: i.nutrition.proteinG,
      carbs: i.nutrition.carbohydrateG,
      fat: i.nutrition.fatG,
    })),
  };
}

/**
 * The update payload for `draft` against the meal it was opened on: every
 * weighed row of a resized dish at its new grams, and every row of a dish that
 * was taken out.
 */
export function persistedEditFrom(
  meal: PersistedMeal,
  draft: MealEditDraft
): PersistedMealEdit {
  const out: PersistedMealEdit = { edits: [], removeIds: [] };
  for (const before of draftFromPersisted(meal).dishes) {
    const after = findDish(draft, before.key);
    if (!after) {
      for (const p of before.parts) if (p.id) out.removeIds.push(p.id);
      continue;
    }
    const ratio = servingsOf(after);
    if (Math.abs(ratio - 1) < 1e-9) continue;
    for (const p of before.parts) {
      if (!p.id || p.grams == null || !partScales(p)) continue;
      // Tenths, not whole grams: a 2 g pinch of salt at 1.5× is 3 g, and at a
      // quarter it must not round away to nothing (the action wants > 0).
      const next = Math.max(0.1, Math.round(p.grams * ratio * 10) / 10);
      if (next === p.grams) continue;
      out.edits.push({ id: p.id, newGrams: next });
    }
  }
  return out;
}

/**
 * An unsaved meal's dishes. Each scales off the item as STAGED (`original`), so
 * repeated edits never compound rounding — the base the steppers always used.
 */
export function draftFromStaged(
  items: MealItem[],
  original: MealItem[]
): MealEditDraft {
  const byId = new Map(original.map((o) => [o.id, o]));
  return {
    canRemove: false,
    whole: 1,
    dishes: items.map((item) => {
      const base = byId.get(item.id) ?? item;
      return {
        key: item.id,
        name: item.name,
        unit: item.unit === 'ml' ? 'ml' : 'g',
        vessel: item.vessel,
        grams: item.quantity,
        parts: [
          {
            grams: base.quantity,
            kcal: base.macros.calories,
            protein: base.macros.protein,
            carbs: base.macros.carbs,
            fat: base.macros.fat,
          },
        ],
      };
    }),
  };
}

/**
 * `items` re-scaled to the draft. `repoint` moves a vessel to the tier the new
 * grams may honestly claim — the portion picker's own rule, which lives with
 * the picker.
 */
export function stagedItemsFrom(
  draft: MealEditDraft,
  items: MealItem[],
  repoint: (vessel: ClientVessel, grams: number) => ClientVessel
): MealItem[] {
  return items.map((item) => {
    const dish = findDish(draft, item.id);
    // Untouched dishes come back exactly as they went in — no rounding, no
    // re-derived macros, so they add nothing to the confirm's overrides.
    if (!dish || dish.grams === item.quantity) return item;
    // Back on the amount as staged (1×, or a round trip of edits): commit the
    // staged figure itself. Rounding a fractional one — 12.5 g → 13 g — would
    // leave an override behind that the user had just undone.
    const staged = originalGrams(dish);
    const grams =
      Math.abs(dish.grams - staged) < 1e-6 ? staged : Math.round(dish.grams);
    const t = sumTotals([atGrams(dish, grams)]);
    return {
      ...item,
      quantity: grams,
      macros: {
        calories: t.kcal ?? 0,
        protein: t.protein ?? 0,
        carbs: t.carbs ?? 0,
        fat: t.fat ?? 0,
      },
      vessel: dish.vessel ? repoint(dish.vessel, grams) : item.vessel,
    };
  });
}
