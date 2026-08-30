import {
  isPromptSizingHintsEnabled,
  isProteinPortionDefaultEnabled,
} from '@/lib/ai/pipeline/config/prompt-ablation-flags';
import {
  buildIngredientDataBlock,
  escapeXmlAttribute,
  type MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import { resolvePromptLocale } from '@/lib/ai/prompts/locale';
import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import { buildStaticPrefix } from '@/lib/ai/prompts/text/grounded-estimation';
import {
  PROTEIN_PORTION_DESCRIPTION,
  RICE_PORTION_DESCRIPTION,
} from '@/lib/ai/prompts/text/portion-descriptions';
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
  const sizingHintsEnabled = isPromptSizingHintsEnabled();
  const ricePortionLine = sizingHintsEnabled
    ? `  default_rice_portion: ${RICE_PORTION_DESCRIPTION[cookingHabits.defaultRicePortion]}\n`
    : '';
  const proteinPortionLine =
    sizingHintsEnabled && isProteinPortionDefaultEnabled()
      ? `  default_protein_portion: ${PROTEIN_PORTION_DESCRIPTION[cookingHabits.defaultProteinPortion]}\n`
      : '';

  return `<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
${ricePortionLine}${proteinPortionLine}  sugar_braised: ${cookingHabits.sugarBraised}
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

${ingredientDataBlock}`;
}
