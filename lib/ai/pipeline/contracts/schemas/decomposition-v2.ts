import { z } from 'zod';
import {
  explicitMassSchema,
  sizeModifierSchema,
  stateHintSchema,
} from './portion-evidence';

/**
 * V2 Call 1 ingredient — pure decomposition. Notably absent: `grams`,
 * `weightBasis`, `expectedState`. Those move to Call 2 where the LLM sees
 * the matched DB row and can reason with full context (eliminates the
 * Call-1-grams-ambiguity that forced the convertCookedToRaw fudge in v1).
 *
 * `cookingMethod` defaults from the dish. Mixed-method dishes must use the
 * per-ingredient override on `decomposedIngredientV2Schema.cookingMethod`.
 */
export const decomposedIngredientV2Schema = z
  .object({
    rawName: z
      .string()
      .min(1)
      .describe(
        'Ingredient name in the user\'s language as written or inferred from the user input (e.g., "ức gà", "chicken breast", "nước dùng").'
      ),
    canonicalName: z
      .string()
      .min(1)
      .describe(
        'Disambiguated food-composition vocabulary name used for DB matching.'
      ),
    cookingMethod: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Actual cooking method for this ingredient when it differs from the dish default. Use this override for every differing ingredient in a mixed-method dish (for example: boiled noodles, fried tofu, raw herbs). Otherwise omit it and inherit the dish method.'
      ),
    stateHint: stateHintSchema
      .optional()
      .describe(
        'Hint extracted from the user\'s text. "raw_weight" when the user explicitly said the weight was measured before cooking ("cân sống", "raw weight", "before cooking"); "cooked_weight" when they pinned to as-eaten ("đã nấu xong cân", "after cooking"); "unspecified" or omit when neither — Call 2 infers from cooking method.'
      ),
    stateNote: z
      .string()
      .max(80)
      .optional()
      .describe(
        'Free-form short verbatim user phrase that informed `stateHint`. Helps Call 2 disambiguate unusual phrasings. Optional.'
      ),
    // ---- Structured quantity evidence (Phase 3, NLP-shaped) --------------
    // Extraction ONLY. The LLM never computes grams here — the server-side
    // portion resolver turns (count × unitToken × sizeModifier) into a grams
    // band scoped to a food concept + locale. Omit every field the user did
    // not actually express.
    count: z
      .number()
      .nonnegative()
      .finite()
      .optional()
      .describe(
        'Numeric count the user gave for this item/ingredient (e.g. 2 for "2 bánh bao", 3 for "3 lát"). 0 is VALID and meaningful — extract it verbatim when the user typed zero ("0 fried chicken"); the server clarifies. Omit only when no count was stated.'
      ),
    unitToken: z
      .string()
      .min(1)
      .max(24)
      .optional()
      .describe(
        'Verbatim unit/counter word the count applied to, in the user\'s language ("bánh bao", "cái", "lát", "slice", "cup", "tô", "xiên"). Omit when no unit word was used.'
      ),
    sizeModifier: sizeModifierSchema
      .optional()
      .describe(
        'Size cue the user typed for the unit ("nhỏ"→small, "vừa"→medium, "lớn"→large, "small"/"large"). Omit when unspecified.'
      ),
    explicitMass: explicitMassSchema
      .optional()
      .describe(
        'Set ONLY when the user typed an explicit weight. `basis` is the physical mass basis: gross_as_served for a named bone-in/shell-on object, edible for a boneless/peeled/fillet form, otherwise unknown. Cooking state belongs in stateHint. Never invent a mass.'
      ),
    prepNotes: z
      .array(z.string().min(1).max(60))
      .max(6)
      .optional()
      .describe(
        'Short verbatim user-typed preparation modifiers that change macro density for the SAME food (NOT identity changes, NOT quantity, NOT weight basis, NOT ingredient removals). Examples: ["bỏ da", "bỏ mỡ"], ["nước trong"], ["không dầu"], ["extra oil"]. Omit when there is nothing to add.'
      ),
  })
  .strict();

export const decomposedDishV2Schema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe(
        'User-facing dish name (e.g., "bún bò Huế", "cơm", "thịt kho").'
      ),
    cookingMethod: z
      .string()
      .min(1)
      .describe(
        "Free-form default cooking method for the dish in the user's language. It applies only to ingredients without their own cookingMethod override."
      ),
    cuisineNote: z
      .string()
      .optional()
      .describe('Optional regional/style note for disambiguation.'),
    vesselToken: z
      .string()
      .min(1)
      .max(16)
      .optional()
      .describe(
        'Verbatim vessel/container word the WHOLE dish was served in ("tô", "chén", "dĩa", "ly", "bowl", "plate", "cup", "mug"). Set only when the user quantified the DISH by a vessel; never invent.'
      ),
    vesselSize: sizeModifierSchema
      .optional()
      .describe(
        'Size cue attached to the dish vessel word ("tô nhỏ"→small). Omit when unspecified.'
      ),
    ingredients: z
      .array(decomposedIngredientV2Schema)
      .min(1)
      .describe('Internal ingredient breakdown for DB matching'),
  })
  .strict();

export const mealDecompositionV2Schema = z.object({
  isFood: z
    .boolean()
    .describe(
      'Whether the input describes recognizable food or meal items. false for gibberish, non-food, or unrelated text.'
    ),
  mealItems: z
    .array(decomposedDishV2Schema)
    .describe(
      'Meal decomposed into user-facing items with ingredient breakdown. Empty array when isFood is false.'
    ),
  mealSlot: z
    .enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snack'])
    .nullable()
    .describe(
      'Classified meal slot if confident (Sáng→breakfast, Trưa→lunch, Tối→dinner, Bữa phụ→snack, Brunch→brunch), null if uncertain'
    ),
});

export type StateHint = z.infer<typeof stateHintSchema>;
export type SizeModifier = z.infer<typeof sizeModifierSchema>;
export type ExplicitMass = z.infer<typeof explicitMassSchema>;
export type DecomposedIngredientV2 = z.infer<
  typeof decomposedIngredientV2Schema
>;
export type DecomposedDishV2 = z.infer<typeof decomposedDishV2Schema>;
export type MealDecompositionV2 = z.infer<typeof mealDecompositionV2Schema>;
