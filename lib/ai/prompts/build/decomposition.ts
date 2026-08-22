import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import {
  compressedDecompositionPromptText,
  type DecompositionPromptParts,
  decompositionPromptText,
} from '@/lib/ai/prompts/text/decomposition';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/**
 * Principle A (spec §2): the LLM produces honest physical-world estimates
 * conditioned only on the meal text and the user's cooking identity (country
 * of origin/residence, cookingHabits). Goal, aggression, and calorie targets
 * NEVER reach this prompt — TypeScript enforces the boundary via
 * PromptPersonalizationContext.
 *
 * Spec: docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */

export const DECOMPOSITION_PROMPT_LABEL_ENV =
  'PIPELINE_DECOMPOSITION_PROMPT_LABEL';

export type DecompositionPromptLabel = 'production' | 'compressed';
export type DecompositionPromptBuilder = (
  userContext: PromptPersonalizationContext
) => string;

export function getDecompositionPromptLabel(
  env: Record<string, string | undefined> = process.env
): DecompositionPromptLabel {
  return env[DECOMPOSITION_PROMPT_LABEL_ENV] === 'compressed'
    ? 'compressed'
    : 'production';
}

export function getDecompositionPromptBuilder(
  label: DecompositionPromptLabel = getDecompositionPromptLabel()
): DecompositionPromptBuilder {
  return label === 'compressed'
    ? buildCompressedDecompositionPrompt
    : buildDecompositionPrompt;
}

function buildPromptParts(
  userContext: PromptPersonalizationContext
): DecompositionPromptParts {
  return {
    cookingHabits: userContext.cookingHabits,
    countryLines: [
      buildPromptContextLine('country_of_origin', userContext.countryOfOrigin),
      buildPromptContextLine(
        'country_of_residence',
        userContext.countryOfResidence
      ),
    ].filter((line): line is string => line !== null),
  };
}

export function buildCompressedDecompositionPrompt(
  userContext: PromptPersonalizationContext
): string {
  const outputLanguage = userContext.outputLanguage ?? 'match_user_input';

  return compressedDecompositionPromptText(
    buildPromptParts(userContext),
    outputLanguage
  );
}

/**
 * Build the system prompt for LLM Call 1 (meal decomposition).
 */
export function buildDecompositionPrompt(
  userContext: PromptPersonalizationContext
): string {
  return decompositionPromptText(buildPromptParts(userContext));
}
