// What the manual-logging picker shows for one food-composition row, derived
// from its food card: a clean English name, a raw/cooked label the row's own
// wording supports, the brand, and the vessel the amount ruler offers.
//
// Pure — the search enrichment feeds it rows; the rules live here alone so the
// web and mobile pickers can never disagree about a label.

import { isPlainRice } from '@/lib/ai/portion/data/rice-bowls';
import { pieceKindFromFoodGroup } from '@/lib/ai/portion/vessel/piece';
import type {
  IngredientStateLabel,
  IngredientVesselHint,
} from '@/lib/domain/logging/manual-logging';

export interface CardDisplayInput {
  /** The row's own name (Vietnamese), used only to read the food's kind. */
  namePrimary: string;
  /** `vietnamese_food_composition.type_en` — the food group. */
  typeEn: string | null;
  /** The card's `food` text; null when the row has no card. */
  food: string | null;
  cookingMethod: string | null;
  brand: string | null;
  /** Grams in one bowl of plain rice for the searching user's country. */
  riceBowlG?: number;
}

export interface CardDisplayFields {
  displayNameEn: string | null;
  stateLabel: IngredientStateLabel | null;
  brand: string | null;
  vessel: IngredientVesselHint | null;
}

const RAW_WORDS = /\b(raw|uncooked)\b/i;
const COOKED_WORDS =
  /\b(cooked|boiled|steamed|roasted|grilled|broiled|braised|stewed|simmered|fried|pan-fried|stir-fried|deep-fried|baked|toasted|poached|blanched|microwaved|scrambled|rotisserie)\b/i;
/** Non-drinks that sit in drink-ish groups: powders, concentrates, dry mixes. */
const NOT_POURED =
  /\b(powder|powdered|dry|dried|granules|mix|condensed|concentrate)\b/i;
/** A milk you pour: English on the card, or a Vietnamese name that starts
 *  with "sữa" (but not "sữa chua", yogurt — unless it is "sữa chua uống"). */
const MILK_EN = /\b(milk|kefir|drinking yogurt|yogurt drink)\b/i;
/** Foods made FROM milk: "whole-milk yogurt", "whole milk ricotta". */
const MADE_FROM_MILK =
  /\b(yogurt|cheese|ricotta|butter|cream|pudding|custard|chocolate)\b/i;
const DRINKING_YOGURT = /\b(drinking yogurt|yogurt drink)\b/i;
const MILK_VI = /^sữa(?! chua)|^sữa chua uống/i;
/** Groups whose milks are drinks: dairy and milk (USDA "Dairy and Egg
 *  Products", VN "Milk and products"), soy and nut milks (USDA "Legume…",
 *  VN "Pulses, nuts, seeds…"). Outside them "milk" names an ingredient of
 *  something else (milk chocolate, milk candy). */
const MILK_GROUPS = ['dairy', 'milk', 'legume', 'pulses', 'nut'];
/** Drink groups: USDA "Beverages", VN "Beverage and liquor", "Soft drinks". */
const DRINK_GROUPS = ['beverage', 'soft drink'];
const JUICE = /\b(juice|nectar)\b|nước ép/i;
const SOUP = /\b(soup|broth|stock|bouillon)\b|canh|nước dùng|nước hầm|phở/i;
/**
 * Foods in a meat, poultry or fish group that are not cut into pieces: offal
 * (a chicken heart is 5 g, not a 150 g "medium cut"), shellfish, and meat that
 * was minced, dried, canned or made into a paste. They are weighed in grams.
 */
const NOT_A_CUT =
  /\b(gizzards?|hearts?|livers?|kidneys?|intestines?|tripe|blood|brains?|lungs?|spleen|stomach|tongue|feet|foot|paws?|trotters?|hocks?|ears?|tails?|oxtail|snouts?|head|tendons?|bones?|cartilage|roe|crabs?|shrimps?|prawns?|lobsters?|clams?|oysters?|mussels?|scallops?|snails?|squid|octopus|cuttlefish|shellfish|sea cucumber|jellyfish|krill|cockles?|abalone|locusts?|crickets?|pupae|larvae|silkworms?|insects?|ground|minced|floss|paste|pate|dried|canned|powder|(?:pork|pig|chicken|duck) skin)\b|pâté/i;
/** Spirits pour by the shot, not the cup: weighed in grams. */
const SPIRITS =
  /\b(cognac|whisky|whiskey|vodka|spirits?|liqueur|rum|gin|brandy|soju|sake|baijiu)\b|rượu trắng/i;
/** "Soup" words in things that are not soup: a seasoning, a spice packet. */
const NOT_SOUP = /\b(seasoning|spices?|packet|cubes?|salt)\b/i;
/** Cooked starches that are served in a bowl: rice (not rice flour, paper or
 *  cakes), noodles, porridge, pasta, beans. A bun or a cob of corn is not. */
const BOWL_STARCH =
  /\b(noodles?|porridge|congee|pasta|macaroni|spaghetti|vermicelli|oatmeal|lentils|chickpeas|beans)\b|\brice\b(?! (?:flour|paper|cakes?|crackers?|powder))|xôi|cháo|bún|phở|miến|hủ tiếu|nui|cơm/i;
/** Cooked vegetables served on a plate — but not a bag of chips, or the
 *  tapioca pearls that go in a drink. */
const NOT_PLATED = /\b(chips|crisps|pearls)\b/i;
/**
 * Groups where the raw and cooked weights of a food differ enough that the
 * label changes the number logged: meat, poultry, fish and seafood, eggs,
 * vegetables, grains, legumes, tubers (USDA and VN group names alike). A
 * biscuit is "baked" and a candy is "cooked" in name only — no label there.
 */
const STATE_GROUPS = [
  'meat',
  'poultry',
  'beef',
  'pork',
  'lamb',
  'veal',
  'game',
  'fish',
  'shellfish',
  'seafood',
  'egg',
  'vegetable',
  'legume',
  'pulses',
  'cereal',
  'grain',
  'pasta',
  'starchy',
  'tuber',
  'root',
];

export function cardDisplayFields(input: CardDisplayInput): CardDisplayFields {
  const brand = input.brand?.trim() || null;
  const stateLabel = input.food && !brand ? stateLabelOf(input) : null;
  return {
    displayNameEn: input.food ? cleanCardFoodName(input.food) : null,
    stateLabel,
    brand,
    vessel: vesselHintOf(input, stateLabel),
  };
}

/**
 * Raw only when the card says raw/uncooked; cooked only when it names a
 * cooking method — and only in a group where that changes the weight (see
 * `STATE_GROUPS`). Everything else — canned, dried, smoked, plain yogurt,
 * tofu, biscuits — gets no label: the table's `state` column defaults those
 * to 'raw', which would tell the user to weigh a can of beef "raw".
 */
function stateLabelOf(input: CardDisplayInput): IngredientStateLabel | null {
  const group = (input.typeEn ?? '').toLowerCase();
  if (!STATE_GROUPS.some((g) => group.includes(g))) return null;
  const food = input.food ?? '';
  if (RAW_WORDS.test(food)) return 'raw';
  if (COOKED_WORDS.test(food) || input.cookingMethod) return 'cooked';
  return null;
}

/**
 * The card's food text as a display name: raw/uncooked dropped (the state
 * label says it), Vietnamese asides in parentheses dropped (the Vietnamese
 * name sits right above it), commas tidied, first letter capitalised.
 * "goby (cá bống), raw" → "Goby"; "raw skinless chicken breast" → "Skinless
 * chicken breast".
 */
export function cleanCardFoodName(food: string): string {
  const cleaned = food
    // biome-ignore lint/suspicious/noControlCharactersInRegex: the \x00-\x7F range is how a non-ASCII (Vietnamese) aside is recognised.
    .replace(/\s*\([^)]*[^\x00-\x7F][^)]*\)/g, '')
    .replace(new RegExp(RAW_WORDS.source, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(,\s*)+/g, ', ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Pieces for meat, poultry and fish (the same food-group rule the AI pipeline
 * uses); cups for drinks, milk and juice; bowls for soups and cooked grains or
 * legumes; plates for cooked vegetables and tubers. Anything else — raw rice,
 * oils, spices, raw produce — is weighed in grams.
 */
function vesselHintOf(
  input: CardDisplayInput,
  stateLabel: IngredientStateLabel | null
): IngredientVesselHint | null {
  const group = (input.typeEn ?? '').toLowerCase();
  const text = `${input.namePrimary} ${input.food ?? ''}`;
  if (input.typeEn) {
    const kind = pieceKindFromFoodGroup(input.typeEn, text);
    if (kind) {
      return NOT_A_CUT.test(input.food ?? '')
        ? null
        : { family: 'piece', kind };
    }
  }
  if (NOT_POURED.test(text)) return null;

  const food = input.food ?? '';
  const pouredMilkEn =
    MILK_EN.test(food) &&
    (!MADE_FROM_MILK.test(food) || DRINKING_YOGURT.test(food));
  const milk =
    MILK_GROUPS.some((g) => group.includes(g)) &&
    (pouredMilkEn || MILK_VI.test(input.namePrimary));
  // Juice pours whatever group holds it (VN files canned juice under
  // "Canned food").
  const drink =
    DRINK_GROUPS.some((g) => group.includes(g)) || milk || JUICE.test(text);
  if (drink) {
    return SPIRITS.test(text) ? null : { family: 'cup', dishClass: 'drink' };
  }

  if ((group.includes('soup') || SOUP.test(text)) && !NOT_SOUP.test(text)) {
    return { family: 'bowl', dishClass: 'soup' };
  }
  if (stateLabel !== 'cooked') return null;
  // Vegetables first: boiled green beans go on a plate, not in the bean bowl.
  if (['vegetable', 'starchy', 'tuber'].some((g) => group.includes(g))) {
    return NOT_PLATED.test(text)
      ? null
      : { family: 'plate', dishClass: 'solid' };
  }
  if (!BOWL_STARCH.test(text)) return null;
  // Plain rice starts at one bowl as eaten in the user's country, not at the
  // bowl's volume (~225 g): see `lib/ai/portion/data/rice-bowls.ts`.
  return input.riceBowlG !== undefined &&
    isPlainRice([input.food, input.namePrimary])
    ? { family: 'bowl', dishClass: 'solid', smallBowlG: input.riceBowlG }
    : { family: 'bowl', dishClass: 'solid' };
}
