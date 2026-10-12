// What the manual-logging picker shows for one food-composition row, derived
// from its food card: a clean English name, a raw/cooked label the row's own
// wording supports, the brand, and the vessel the amount ruler offers.
//
// Pure — the search enrichment feeds it rows; the rules live here alone so the
// web and mobile pickers can never disagree about a label.

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
/** Groups whose milks are drinks: dairy, soy (legumes) and nut milks. Outside
 *  them "milk" names an ingredient of something else (milk chocolate). */
const MILK_GROUPS = ['dairy', 'legume', 'nut'];
const JUICE = /\b(juice|nectar)\b|nước ép/i;
const SOUP = /\b(soup|broth|stock|bouillon)\b|canh|nước dùng|nước hầm|phở/i;

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
 * cooking method. Everything else — canned, dried, smoked, plain yogurt, tofu —
 * gets no label: the table's `state` column defaults those to 'raw', which
 * would tell the user to weigh a can of beef "raw".
 */
function stateLabelOf(input: CardDisplayInput): IngredientStateLabel | null {
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
    if (kind) return { family: 'piece', kind };
  }
  if (NOT_POURED.test(text)) return null;

  const food = input.food ?? '';
  const pouredMilkEn =
    MILK_EN.test(food) &&
    (!MADE_FROM_MILK.test(food) || DRINKING_YOGURT.test(food));
  const milk =
    MILK_GROUPS.some((g) => group.includes(g)) &&
    (pouredMilkEn || MILK_VI.test(input.namePrimary));
  const drink =
    group.includes('beverage') ||
    milk ||
    (group.includes('fruit') && JUICE.test(text));
  if (drink) return { family: 'cup', dishClass: 'drink' };

  if (group.includes('soup') || SOUP.test(text)) {
    return { family: 'bowl', dishClass: 'soup' };
  }
  if (stateLabel !== 'cooked') return null;
  if (group.includes('cereal') || group.includes('legume')) {
    return { family: 'bowl', dishClass: 'solid' };
  }
  if (group.includes('vegetable') || group.includes('starchy')) {
    return { family: 'plate', dishClass: 'solid' };
  }
  return null;
}
