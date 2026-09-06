import { resolvePromptLocale } from '@/lib/ai/prompts/locale';
import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import {
  decompositionV2PromptText,
  USER_INPUT_CLOSE,
  USER_INPUT_OPEN,
} from '@/lib/ai/prompts/text/decomposition-v2';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/**
 * V2 Call 1 — pure decomposition.
 *
 * Subtractive vs v1: this prompt does NOT ask for `grams`, `weightBasis`, or
 * `expectedState` per ingredient. Weight estimation moves to Call 2, where
 * the LLM sees the matched DB row's state and can scope the number
 * correctly without the convertCookedToRaw fudge.
 *
 * Additive vs v1: `stateHint` (closed enum) + `stateNote` (free-form short
 * phrase) preserve the user's signal about whether they weighed raw or
 * cooked, but as informational hints — not forcing functions.
 *
 * Prompt-cache layout: static instructions + `<user_context>` come FIRST so
 * Vertex's implicit context cache (≥2048 token threshold) can hit on the
 * prefix; per-request data is just the user's meal text which the caller
 * appends as the user-role message.
 */

/**
 * Wrap raw user meal text in the named data delimiter, neutralizing delimiter
 * collisions first: any literal occurrence of the open/close tokens in the
 * user's text is stripped so a crafted input can't forge a boundary and smuggle
 * instructions outside the data span. Prompt-injection hardening (Phase 1 D3).
 */
export function wrapUserMealTextAsData(rawInput: string): string {
  const neutralized = rawInput
    .split(USER_INPUT_OPEN)
    .join(' ')
    .split(USER_INPUT_CLOSE)
    .join(' ');
  return `${USER_INPUT_OPEN}\n${neutralized}\n${USER_INPUT_CLOSE}`;
}

function buildCountryContextLines(
  userContext: PromptPersonalizationContext
): string[] {
  return [
    buildPromptContextLine('country_of_origin', userContext.countryOfOrigin),
    buildPromptContextLine(
      'country_of_residence',
      userContext.countryOfResidence
    ),
  ].filter((line): line is string => line !== null);
}

export function buildDecompositionV2Prompt(
  userContext: PromptPersonalizationContext
): string {
  return decompositionV2PromptText(
    buildCountryContextLines(userContext),
    resolvePromptLocale(userContext),
    userContext.outputLanguage
  );
}
