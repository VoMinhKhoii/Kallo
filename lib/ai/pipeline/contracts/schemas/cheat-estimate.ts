import { z } from 'zod';

// ===========================================================================
// CHEAT-MEAL SLIDER ESTIMATE SCHEMA
// ===========================================================================
//
// A cheat meal (buffet, BBQ, a box of donuts) is impossible to itemize, so we
// skip decomposition entirely. A reasoning-enabled model turns the occasion
// into a few labeled 0–10 sliders the user places themselves on. Each macro
// slider owns ONE nutrient axis and carries sparse, context-interpretable
// anchors; the optional drinks slider is the one multi-nutrient axis (soda→
// carbs, creamy→fat, alcohol→ethanol). The client/server resolve final
// nutrition from the chosen levels via `lib/cheat/slider-nutrition.ts`.

export const cheatSliderKeySchema = z.enum([
  'protein',
  'carbs',
  'fat',
  'drinks',
]);

export const cheatSliderAnchorSchema = z.object({
  level: z
    .number()
    .min(0)
    .max(10)
    .describe('Position on the 0–10 slider for this keypoint.'),
  label: z
    .string()
    .min(1)
    .max(80)
    .describe(
      'Short, context-interpretable scenario in the user\'s language, e.g. "vài miếng nigiri", "ba chỉ + đồ chiên". NOT a generic "a little/normal/a lot".'
    ),
  proteinG: z
    .number()
    .min(0)
    .optional()
    .describe('Protein grams at this level. Only on the protein slider.'),
  carbohydrateG: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Carbohydrate grams at this level. On the carbs slider, and on the drinks slider for sugary drinks.'
    ),
  fatG: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Fat grams at this level. On the fat slider, and on the drinks slider for creamy drinks.'
    ),
  alcoholG: z
    .number()
    .min(0)
    .optional()
    .describe('Ethanol grams at this level. Only on the drinks slider.'),
});

export const cheatSliderSchema = z.object({
  key: cheatSliderKeySchema,
  label: z
    .string()
    .min(1)
    .max(40)
    .describe('Localized dial name, e.g. "Thịt / hải sản", "Độ béo".'),
  defaultLevel: z
    .number()
    .min(0)
    .max(10)
    .describe('The single best-guess level; the slider starts here.'),
  // No .max() here: Gemini's responseJsonSchema rejects a schema whose nested
  // bounded arrays unroll to too many fields. sliders.max(4) × anchors.max(11)
  // × the 6-property anchor object tripped that limit with 400 INVALID_ARGUMENT.
  // Capping anchor count is non-essential (the prompt asks for sparse keypoints
  // incl. level 0 and 10), so we drop the upper bound and keep the .min(2) floor.
  anchors: z
    .array(cheatSliderAnchorSchema)
    .min(2)
    .describe(
      'Sparse keypoints; MUST include level 0 and level 10. Grams between anchors are interpolated.'
    ),
});

export const cheatClarifyingQuestionSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(160)
    .describe('One short question, asked only when the occasion is too vague.'),
  options: z
    .array(z.string().min(1).max(40))
    .min(2)
    .max(5)
    .optional()
    .describe('Optional answer chips.'),
});

export const cheatEstimateSchema = z.object({
  sliders: z
    .array(cheatSliderSchema)
    .max(4)
    .describe(
      'The macro sliders (protein, carbs, fat) plus an optional drinks slider when plausible. Empty/loose only when clarifyingQuestion is set.'
    ),
  mealSlot: z
    .enum(['breakfast', 'brunch', 'lunch', 'dinner', 'snack'])
    .nullable()
    .describe('Inferred meal slot, or null if uncertain.'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Overall confidence in the occasion estimate.'),
  clarifyingQuestion: cheatClarifyingQuestionSchema
    .optional()
    .describe(
      'Set ONLY when the free-text is too vague to author sensible anchors. The client asks it, then re-calls with the answer.'
    ),
});

export type CheatEstimate = z.infer<typeof cheatEstimateSchema>;
