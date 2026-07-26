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

export function resolveVesselEnvelope(dish: DishLike): VesselEnvelope | null {
  if (
    !dish.vesselToken ||
    dish.ingredients.some((ingredient) => ingredient.count === 0)
  ) {
    return null;
  }

  const resolved = resolveVesselFromToken(dish.vesselToken, dish.vesselSize);
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
    token: dish.vesselToken,
    vesselMl: VESSEL_FAMILIES[resolved.family].tiers[tier].ml,
    guardG: guardBandG(resolved.family, tier, dishClass),
    midG: midG(resolved.family, tier, dishClass),
  };
}

export function attachVesselToResult<
  T extends { mealItems: Array<{ name: string; vessel?: unknown }> },
>(result: T, dishes: DishLike[], envelopes: Array<VesselEnvelope | null>): T {
  for (const [index, dish] of dishes.entries()) {
    const envelope = envelopes[index] ?? null;
    const mealItem = result.mealItems[index];
    if (
      envelope &&
      mealItem &&
      mealItem.name.toLocaleLowerCase() === dish.name.toLocaleLowerCase()
    ) {
      mealItem.vessel = {
        family: envelope.family,
        tier: envelope.tier,
        dishClass: envelope.dishClass,
        token: envelope.token,
        guardG: envelope.guardG,
        midG: envelope.midG,
        provenance: 'vessel_prior',
      };
    }
  }
  return result;
}
