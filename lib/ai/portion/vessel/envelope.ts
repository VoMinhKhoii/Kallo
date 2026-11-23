import { isPlainRice, riceBowlFor } from '@/lib/ai/portion/data/rice-bowls';
import {
  type DishClass,
  VESSEL_FAMILIES,
  type VesselFamily,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import type { GramsBand } from '@/lib/ai/portion/types';
import {
  guardBandG,
  isSmallBowlG,
  midG,
  normalizeVesselToken,
  resolveVesselFromToken,
  singularWord,
} from '@/lib/ai/portion/vessel/geometry';
import { resolvePieceVessel } from '@/lib/ai/portion/vessel/piece';
import type { PipelineMealItem } from '@/lib/ai/types/result';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

export interface DishLike {
  name: string;
  cookingMethod?: string;
  vesselToken?: string;
  vesselSize?: 'small' | 'medium' | 'large';
  /** How many of the whole dish ("2 tô phở" → 2 tô), when Call 1 counted it. */
  dishCount?: { count: number; unitToken: string } | null;
  ingredients: Array<{
    rawName?: string;
    canonicalName?: string;
    queryEn?: string;
    count?: number;
    unitToken?: string;
    explicitMass?: { grams: number };
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
  /** How many of the vessel the dish is (`guardG` and `midG` cover them all). */
  servings: number;
  /** Grams in ONE bowl of this food, when it is plain rice: the user's
   *  country's rice bowl, which the picker shows instead of the bowl's
   *  geometry. */
  smallBowlG?: number;
}

const SOUP_INGREDIENT = /nước dùng|nước lèo|nước súp|canh|súp|broth|stock/i;
const SOUP_METHOD = /ninh|nấu canh/i;
// `mì gói` and friends are listed explicitly rather than as a bare `mì`: the
// bare form also covers dry-tossed dishes (mì xào, mì khô) that are NOT soup,
// while an instant-noodle bowl essentially always is. Without these, "1 tô mì
// gói" classified `solid` and got a dense-food gram band for what is mostly
// broth — the same tier a bowl of phở correctly avoids.
const SOUP_DISH =
  /phở|pho\b|bún bò|bún riêu|hủ tiếu|miến|bánh canh|cháo|mì gói|mì tôm|mì ăn liền|mi goi|mi tom|mi an lien|instant noodle|ramen|udon|soba|noodle soup|soup|congee|laksa|malatang/i;
const AIRY_DISH = /gỏi|nộm|salad|rau trộn/i;
const LARGE_BOWL_DISH = /ramen|donburi|malatang|lẩu mini/i;

/** `words` as whole words: "kho" never matches "khoai". Test NFC text. */
function wordsPattern(words: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{M}])(?:${words})(?![\\p{L}\\p{M}])`, 'iu');
}

const nfc = (text: string | undefined) => (text ?? '').normalize('NFC');

// A braise or curry is meat or fish in a little sauce eaten over rice, not a
// broth left in the bowl, even when Call 1 lists a stock among its parts.
const BRAISE_DISH = wordsPattern(
  'kho|cà ri|cari|curry|stew|rendang|ragu|ragout|braised?|goulash'
);
// In the North a "bát" holds noodle soup as well as rice: "1 bát phở" is a
// noodle bowl, not a rice bowl. "bánh mì" is bread, not noodles.
const NOODLE_SOUP = wordsPattern(
  'phở|pho|bún|miến|hủ tiếu|bánh canh|(?<!bánh\\s)mì|noodles?|ramen|udon|soba'
);
const NAMED_SOUP = wordsPattern('soup|súp|laksa|canh|lẩu|hotpot');
// A milk tea or bubble tea is sold in a 500 ml cup at its smallest size.
const LARGE_CUP_DRINK = wordsPattern(
  'trà sữa|tra sua|milk ?tea|bubble tea|boba|trân châu'
);
const FOOD_IN_CUP =
  /mì|noodle|ramen|soup|súp|cháo|rice|cơm|cake|yogurt|granola|oatmeal/i;
const SOUP_IN_CUP = /mì|noodle|ramen|soup|súp|cháo/i;

export function classifyDishClass(
  dish: DishLike,
  vesselFamily: VesselFamily
): DishClass {
  if (vesselFamily === 'cup' && !FOOD_IN_CUP.test(dish.name)) return 'drink';
  // A braise in noodle soup ("hủ tiếu bò kho", "curry laksa") stays soup.
  const name = nfc(dish.name);
  if (
    (BRAISE_DISH.test(name) || BRAISE_DISH.test(nfc(dish.cookingMethod))) &&
    !NOODLE_SOUP.test(name) &&
    !NAMED_SOUP.test(name)
  ) {
    return 'solid';
  }

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
 *
 * And to a single SERVING: "3 cups of milk" stays a plain counted food that
 * Call 2 sizes from its count, as it did before the band followed a dish
 * vessel's count (`vesselCount`). Promoting it as well is a separate change.
 */
function dishVesselToken(dish: DishLike): string | undefined {
  if (dish.vesselToken) return dish.vesselToken;
  if (dish.ingredients.length !== 1) return undefined;
  const { unitToken: token, count } = dish.ingredients[0];
  if (count !== undefined && count > 1) return undefined;
  // Only a real container word — `resolveVesselFromToken` rejects piece and
  // mass units, so "2 steaks" can never become a vessel this way.
  return token && resolveVesselFromToken(token) ? token : undefined;
}

/** Bowl words that, holding plain rice, mean one everyday rice bowl. "tô"
 *  stays out: it names a big noodle bowl. */
const RICE_BOWL_TOKENS = new Set(['chen', 'bat', 'bowl']);

/**
 * A plain bowl of rice: the dish's only ingredient is plain cooked rice, in a
 * rice-bowl word. Returns how many bowls, or null. A rice bowl is sized by
 * the user's country (`riceBowlFor`), not by the bowl's volume: a 300 ml chén
 * at solid-food density allows 110–260 g, and an English "bowl" defaults to
 * the 700 ml medium bowl (250–600 g) — both far above a real bowl of rice.
 */
function riceBowls(dish: DishLike, vesselToken: string): number | null {
  if (!RICE_BOWL_TOKENS.has(normalizeVesselToken(vesselToken))) return null;
  if (dish.ingredients.length !== 1) return null;
  const [rice] = dish.ingredients;
  if (
    !isPlainRice([rice.rawName, rice.canonicalName, rice.queryEn, dish.name])
  ) {
    return null;
  }
  return rice.count !== undefined && rice.count > 0 ? rice.count : 1;
}

/**
 * The dish's own count when it is a count of its vessel ("2 tô phở" → 2;
 * "nửa dĩa cơm chiên" → 0.5): Call 1's `dishCount`, in a word of the vessel's
 * family. A count in another word ("2 phần") says nothing about the vessel.
 */
function dishVesselCount(
  dish: DishLike,
  resolved: { family: VesselFamily }
): number | null {
  const count = dish.dishCount;
  if (!count || !(count.count > 0)) return null;
  const unit =
    resolveVesselFromToken(count.unitToken) ??
    resolveVesselFromToken(singularWord(normalizeVesselToken(count.unitToken)));
  return unit?.family === resolved.family ? count.count : null;
}

/**
 * Legacy reading, for a dish without `dishCount` (a stored meal, or Call 1's
 * answer before the dish-count check): how many of the dish's vessel the user
 * ate, from the count its parts carry in the
 * vessel's own word ("2 tô phở" → 2 on bánh phở, beef and broth; "1/2 chén bò
 * kho" → 0.5). The band and mid grams describe one vessel, so "2 bowls of
 * ramen" must not be fit into one bowl, nor half a chén into a whole one. The
 * count is the dish's when it spread to at least two foods, or no other food
 * carries an amount of its own (a count or a typed weight): a lone "half a
 * bowl of broth" beside noodles and pork counted or weighed in their own words
 * is the broth's amount, while half a chén
 * written only on the beef of a bò kho, beside unmeasured oil and lemongrass,
 * is the dish's. Parts that disagree, or no such count, read as one.
 */
function vesselCount(dish: DishLike, vesselToken: string): number {
  const token = normalizeVesselToken(vesselToken);
  const carrying = dish.ingredients.filter(
    (i) =>
      i.count !== undefined &&
      i.count > 0 &&
      normalizeVesselToken(i.unitToken ?? '') === token
  );
  if (carrying.length === 0) return 1;
  const ownAmounts = dish.ingredients.some(
    (i) =>
      !carrying.includes(i) &&
      (i.count !== undefined || i.explicitMass !== undefined) &&
      !isDiscreteOilIngredient(i.rawName ?? '')
  );
  if (carrying.length < 2 && ownAmounts) return 1;
  const counts = new Set(carrying.map((i) => i.count as number));
  const [count] = counts;
  return counts.size === 1 ? count : 1;
}

/**
 * The tier for this dish's vessel word and size. A bát of noodle soup and a
 * cup of milk tea sit one tier above the word's own (a typed size still moves
 * them); a ramen bowl with no size typed is a large bowl.
 */
function dishTier(
  dish: DishLike,
  vesselToken: string,
  resolved: { family: VesselFamily; tier: VesselTier },
  dishClass: DishClass
): VesselTier {
  if (
    resolved.family === 'bowl' &&
    dish.vesselSize === undefined &&
    LARGE_BOWL_DISH.test(dish.name)
  ) {
    return 3;
  }
  const name = nfc(dish.name);
  const upOne =
    (resolved.family === 'bowl' &&
      dishClass === 'soup' &&
      normalizeVesselToken(vesselToken) === 'bat' &&
      NOODLE_SOUP.test(name)) ||
    (resolved.family === 'cup' && LARGE_CUP_DRINK.test(name));
  return upOne ? (Math.min(4, resolved.tier + 1) as VesselTier) : resolved.tier;
}

export function resolveVesselEnvelope(
  dish: DishLike,
  riceBowl: GramsBand = riceBowlFor({})
): VesselEnvelope | null {
  const vesselToken = dishVesselToken(dish);
  if (
    !vesselToken ||
    dish.ingredients.some((ingredient) => ingredient.count === 0)
  ) {
    return null;
  }

  const resolved = resolveVesselFromToken(vesselToken, dish.vesselSize);
  if (!resolved) return null;

  const bowls =
    resolved.family === 'bowl' ? riceBowls(dish, vesselToken) : null;
  // A bowl of rice is a small bowl whatever the word: "a bowl of rice" is a
  // rice bowl, not the medium noodle bowl a bare "bowl" defaults to.
  const dishClass = classifyDishClass(dish, resolved.family);
  const tier: VesselTier = bowls
    ? 1
    : dishTier(dish, vesselToken, resolved, dishClass);
  // Every band describes one vessel; the dish is that many of them.
  const servings =
    bowls ?? dishVesselCount(dish, resolved) ?? vesselCount(dish, vesselToken);
  const oneVessel: GramsBand = bowls
    ? riceBowl
    : {
        ...guardBandG(resolved.family, tier, dishClass),
        mid: midG(resolved.family, tier, dishClass),
      };
  const scale = (g: number) => Math.round(g * servings);

  return {
    family: resolved.family,
    tier,
    dishClass,
    token: vesselToken,
    vesselMl: VESSEL_FAMILIES[resolved.family].tiers[tier].ml,
    guardG: { low: scale(oneVessel.low), high: scale(oneVessel.high) },
    midG: scale(oneVessel.mid),
    servings,
    // One bowl's grams: the picker multiplies it by the vessel's count, so
    // half a bowl and two bowls both read in whole rice bowls.
    ...(bowls && isSmallBowlG(riceBowl.mid)
      ? { smallBowlG: riceBowl.mid }
      : {}),
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
        ...(envelope.servings !== 1 ? { count: envelope.servings } : {}),
        ...(envelope.smallBowlG ? { smallBowlG: envelope.smallBowlG } : {}),
        provenance: 'vessel_prior',
      };
    }
    if (!mealItem.vessel) {
      const pieceVessel = resolvePieceVessel(mealItem, dish);
      if (pieceVessel) mealItem.vessel = pieceVessel;
    }
  }
}
