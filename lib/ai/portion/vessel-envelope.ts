import type { PipelineMealItem } from '../types';
import { resolvePieceVessel } from './piece-vessel';
import {
  type DishClass,
  guardBandG,
  midG,
  resolveVesselFromToken,
  VESSEL_FAMILIES,
  type VesselFamily,
  type VesselTier,
} from './vessel-data';

export interface DishLike {
  name: string;
  cookingMethod?: string;
  vesselToken?: string;
  vesselSize?: 'small' | 'medium' | 'large';
  ingredients: Array<{
    rawName?: string;
    canonicalName?: string;
    count?: number;
    unitToken?: string;
  }>;
}

export interface VesselEnvelope {
  family: Extract<VesselFamily, 'bowl' | 'plate' | 'cup'>;
  tier: VesselTier;
  dishClass: DishClass;
  token: string;
  vesselMl: number;
  guardG: { low: number; high: number };
  midG: number;
}

const SOUP_INGREDIENT = /nước dùng|nước lèo|nước súp|canh|súp|broth|stock/i;
const SOUP_METHOD = /ninh|nấu canh/i;
const SOUP_DISH =
  /phở|pho\b|bún bò|bún riêu|hủ tiếu|miến|bánh canh|cháo|ramen|udon|soba|noodle soup|soup|stew|congee|laksa|malatang/i;
const AIRY_DISH = /gỏi|nộm|salad|rau trộn/i;
const LARGE_BOWL_DISH = /ramen|donburi|malatang|lẩu mini/i;
const FOOD_IN_CUP =
  /mì|noodle|ramen|soup|súp|cháo|rice|cơm|cake|yogurt|granola|oatmeal/i;
const SOUP_IN_CUP = /mì|noodle|ramen|soup|súp|cháo/i;

export function classifyDishClass(
  dish: DishLike,
  vesselFamily: VesselFamily
): DishClass {
  if (vesselFamily === 'cup' && !FOOD_IN_CUP.test(dish.name)) return 'drink';

  const hasSoupIngredient = dish.ingredients.some((ingredient) =>
    SOUP_INGREDIENT.test(
      `${ingredient.rawName ?? ''} ${ingredient.canonicalName ?? ''}`
    )
  );
  if (
    hasSoupIngredient ||
    SOUP_METHOD.test(dish.cookingMethod ?? '') ||
    SOUP_DISH.test(dish.name) ||
    (vesselFamily === 'cup' && SOUP_IN_CUP.test(dish.name))
  ) {
    return 'soup';
  }
  if (AIRY_DISH.test(dish.name)) return 'airy';
  return 'solid';
}

/**
 * The container word for this dish, whether Call 1 put it on the dish or on the
 * ingredient.
 *
 * The prompt asks for BOTH on a single-ingredient dish quantified by a vessel
 * ("1 chén cơm" → ingredient `count`+`unitToken` AND meal-item `vesselToken`),
 * and the model does not always comply: for "3 piece of salmon + 2 steaks +
 * 1 cup of milk + 1 plate of spaghetti" it emitted `vesselToken: "plate"` on
 * the spaghetti but put the milk's "cup" only on the ingredient. Milk then fell
 * through BOTH resolvers — not a dish vessel, and "cup" is not a piece token —
 * so a plainly-quantified drink got no portion affordance at all.
 *
 * Deriving it here makes the outcome independent of which slot the model
 * chose. Restricted to a SINGLE-ingredient dish on purpose: in a composed dish
 * one ingredient measured in cups ("phở with a cup of broth") says nothing
 * about what the dish was served in.
 */
function dishVesselToken(dish: DishLike): string | undefined {
  if (dish.vesselToken) return dish.vesselToken;
  if (dish.ingredients.length !== 1) return undefined;
  const token = dish.ingredients[0].unitToken;
  // Only a real container word — `resolveVesselFromToken` rejects piece and
  // mass units, so "2 steaks" can never become a vessel this way.
  return token && resolveVesselFromToken(token) ? token : undefined;
}

export function resolveVesselEnvelope(dish: DishLike): VesselEnvelope | null {
  const vesselToken = dishVesselToken(dish);
  if (
    !vesselToken ||
    dish.ingredients.some((ingredient) => ingredient.count === 0)
  ) {
    return null;
  }

  const resolved = resolveVesselFromToken(vesselToken, dish.vesselSize);
  if (!resolved) return null;

  const tier =
    resolved.family === 'bowl' &&
    dish.vesselSize === undefined &&
    LARGE_BOWL_DISH.test(dish.name)
      ? 3
      : resolved.tier;
  const dishClass = classifyDishClass(dish, resolved.family);

  return {
    family: resolved.family,
    tier,
    dishClass,
    token: vesselToken,
    vesselMl: VESSEL_FAMILIES[resolved.family].tiers[tier].ml,
    guardG: guardBandG(resolved.family, tier, dishClass),
    midG: midG(resolved.family, tier, dishClass),
  };
}

export function attachVesselToMealItems(
  mealItems: PipelineMealItem[],
  dishes: DishLike[],
  envelopes: Array<VesselEnvelope | null>
): void {
  for (const [index, dish] of dishes.entries()) {
    const envelope = envelopes[index] ?? null;
    const mealItem = mealItems[index];
    const namesMatch =
      mealItem?.name.toLocaleLowerCase() === dish.name.toLocaleLowerCase();
    if (!mealItem || !namesMatch) continue;
    if (envelope) {
      mealItem.vessel = {
        family: envelope.family,
        tier: envelope.tier,
        dishClass: envelope.dishClass,
        provenance: 'vessel_prior',
      };
    }
    if (!mealItem.vessel) {
      const pieceVessel = resolvePieceVessel(mealItem, dish);
      if (pieceVessel) mealItem.vessel = pieceVessel;
    }
  }
}
