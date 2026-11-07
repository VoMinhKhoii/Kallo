import { riceBowlFor } from '@/lib/ai/portion/data/rice-bowls';
import {
  buildIngredientDataBlock,
  escapeXmlAttribute,
  type MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import { resolvePromptLocale } from '@/lib/ai/prompts/locale';
import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import {
  buildStaticPrefix,
  CALIBRATION_RULE,
  DISH_SIZING_RULE,
  SHARE_RULE,
} from '@/lib/ai/prompts/text/grounded-estimation';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/**
 * V2 Call 2 — grounded estimation.
 *
 * What it does:
 *   1. CRAG verdict — for each ingredient with candidate matches, pick the
 *      correct one or reject all ("none" → unmatched path).
 *   2. Mass — emit edible grams by default, or grossG + refusePct behind the
 *      schema flag, scoped to the selected candidate state. The server
 *      derives edible mass with no convertCookedToRaw fudge.
 *   3. Macros — bounded triples, server-anchored for matched-without-prep-notes,
 *      LLM-driven within tight bands when prep_notes is non-empty.
 *
 * Prompt layout:
 *   STATIC PREFIX (universal rules — same bytes across all users / requests)
 *       ↓
 *   PER-USER BLOCK (<user_context> — same bytes within a user's session)
 *       ↓
 *   DYNAMIC SUFFIX (<original_prompt> + <ingredient_data> with candidates —
 *                   request-specific)
 *
 * Note: the original intent of this layout was to clear Vertex's implicit
 * context-cache threshold (≥2,048 tokens for Gemini 2.5; ≥4,096 for 3+).
 * Measured prefix today: ~1,341 tokens (compressed) / ~1,915 tokens
 * (production), both below the 2.5 floor. Implicit caching may not fire
 * unless padded; treat the layout as "ready to benefit when prefix grows"
 * rather than "actively cached".
 *
 * Output schema: groundedEstimationSchema in
 * `pipeline/contracts/schemas/grounded-estimation.ts`.
 */

/**
 * Candidate ranking (matching gate 2026-10-08): most wrong picks were the
 * generic sibling of a row that named the user's specific variety/flavor/form.
 */
const RANKING_RULES = `Ranking: when the user names a specific variety, flavor, form, preparation or brand, the candidate whose name states those words ranks above a generic sibling that omits them; never choose the generic row while a candidate states the user's specific words.`;

function buildUserContextBlock(
  userContext: PromptPersonalizationContext
): string {
  const { cookingHabits } = userContext;
  const countryLines = [
    buildPromptContextLine('country_of_origin', userContext.countryOfOrigin),
    buildPromptContextLine(
      'country_of_residence',
      userContext.countryOfResidence
    ),
  ].filter((line): line is string => line !== null);
  // No default_rice_portion / default_protein_portion lines: the onboarding
  // portion defaults pushed Call 2's grams up on the 2026-10-12 benchmark, so
  // Call 2 sizes from the meal text alone.
  const riceBowl = riceBowlFor(userContext);
  return `<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  rice_bowl_g: ${riceBowl.mid} (small ${riceBowl.low}, full ${riceBowl.high})
  oil_usage: ${cookingHabits.oilUsage}
  broth_consumption: ${cookingHabits.brothConsumption}
</user_context>`;
}

/**
 * Build the full grounded-estimation system prompt.
 *
 * Order:
 *   1. STATIC PREFIX (cacheable across all users / requests)
 *   2. user_context (cacheable per user)
 *   3. <original_prompt> (request-specific — the user's verbatim meal text)
 *   4. <ingredient_data> (request-specific — decomposed names + candidates)
 *   5. ranking rules, then the share / calibration / dish-sizing rules —
 *      static text, but kept last because that is the position that was
 *      measured (2026-10-12 grams hill climb)
 */
export function buildGroundedEstimationPrompt(args: {
  originalPrompt: string;
  mealItems: MealItemWithCandidates[];
  userContext: PromptPersonalizationContext;
}): string {
  const locale = resolvePromptLocale(args.userContext);
  const staticPrefix = buildStaticPrefix(
    args.mealItems.some((mealItem) => mealItem.vesselEnvelope != null),
    locale
  );
  const userContextBlock = buildUserContextBlock(args.userContext);
  const originalPromptBlock = `<original_prompt>\n${escapeXmlAttribute(args.originalPrompt)}\n</original_prompt>`;
  const ingredientDataBlock = buildIngredientDataBlock(args.mealItems, {
    includeNameEn: locale === 'global',
  });

  return `${staticPrefix}

${userContextBlock}

${originalPromptBlock}

${ingredientDataBlock}

${RANKING_RULES}${SHARE_RULE}${CALIBRATION_RULE}${DISH_SIZING_RULE}`;
}
