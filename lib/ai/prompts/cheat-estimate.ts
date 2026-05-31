import { buildPromptContextLine } from './sanitize';
import type { PromptPersonalizationContext } from './types';

/**
 * Cheat-meal slider estimator prompt.
 *
 * Principle A (spec §2): like decomposition/nutrition, this prompt sees ONLY
 * the meal text and the user's cooking identity (country of origin/residence,
 * cookingHabits). Goal, aggression, and calorie targets NEVER reach it —
 * TypeScript enforces the boundary via PromptPersonalizationContext.
 *
 * The model turns a cheat occasion into a few labeled 0–10 sliders. Each macro
 * slider owns ONE nutrient and carries context-interpretable anchors; the
 * optional drinks slider is the one multi-nutrient axis. Most of the reasoning
 * budget goes to the FAT slider, whose grams come from many sources that vary
 * by occasion (fatty cuts, frying, butter/cheese, creamy desserts, sauces).
 */

export interface CheatEstimatePromptInput {
  /** Sanitized free-text occasion description. */
  description: string;
  /** Optional cheat-type chip the user tapped (e.g. "Korean BBQ"). */
  cheatType?: string | null;
  /** A prior clarifying-question answer, when re-calling after a vague input. */
  clarifyAnswer?: string | null;
  userContext: PromptPersonalizationContext;
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

export function buildCheatEstimatePrompt(
  input: CheatEstimatePromptInput
): string {
  const { description, cheatType, clarifyAnswer, userContext } = input;
  const { cookingHabits } = userContext;
  const countryLines = buildCountryContextLines(userContext);
  const outputLanguage = userContext.outputLanguage ?? 'match_user_input';

  const occasionLines = [
    buildPromptContextLine('description', description),
    buildPromptContextLine('occasion_type', cheatType ?? undefined),
    buildPromptContextLine('clarifying_answer', clarifyAnswer ?? undefined),
  ].filter((line): line is string => line !== null);

  return `You are a cuisine-aware "cheat meal" estimator. The user is logging an indulgent occasion — an all-you-can-eat buffet, Korean BBQ, a box of donuts — that is impossible to itemize precisely. Do NOT itemize. Instead, turn the occasion into a small set of labeled 0–10 sliders the user can place themselves on. Return JSON only.

<language>
  output_language=${outputLanguage}. Emit every slider label, every anchor label, the rationale, and any clarifyingQuestion in output_language.
  country_of_origin and country_of_residence calibrate portion sizes and which foods are plausible — NOT display language.
</language>

<sliders>
  Emit up to 4 sliders. Always emit the three macro sliders; add the drinks slider only when drinks are plausible for this occasion:
    - key="protein": label it for MEAT/SEAFOOD/eggs. Anchors carry ONLY proteinG.
    - key="carbs": label it for RICE/NOODLES/bread/pancakes/sweet wrappers. Anchors carry ONLY carbohydrateG.
    - key="fat": label it for OVERALL RICHNESS. Anchors carry ONLY fatG.
    - key="drinks" (optional): label it for BEVERAGES. Anchors may carry carbohydrateG (sugary drinks), fatG (creamy drinks), and alcoholG (beer/wine/spirits) together. Omit this slider entirely for occasions where drinks are unlikely (e.g. a box of donuts).
  Each slider has: a localized label, a defaultLevel (0–10, your single best guess for THIS user/occasion — the slider starts here), and anchors.
  Anchors are sparse keypoints (typically 3–5). You MUST include an anchor at level 0 and an anchor at level 10. Each anchor's label is a concrete, recognizable scenario — NOT "a little / normal / a lot". Grams between anchors are linearly interpolated by the client.
  Anchor grams are TOTAL as-eaten grams of that nutrient for the whole occasion at that level (not per 100g, not per dish).
</sliders>

<fat_slider_reasoning>
  Spend the bulk of your reasoning here. Meat→protein and rice→carbs are near-mechanical, but FAT has many sources that vary entirely by occasion: fatty vs lean cuts (e.g. pork belly), frying oil, butter/cheese, creamy desserts / ice cream, rich sauces and dips. Enumerate the plausible fat sources for THIS specific occasion, then synthesize them into the anchor scenarios and grams.
  Example — Korean BBQ: level 0 "mostly lean cuts, grilled" · level 3 "some pork belly" · level 5 "lots of pork belly + fried sides" · level 10 "fatty cuts + everything fried + ice-cream dessert".
  Example — box of donuts: anchors range over pastry/glaze richness instead.
</fat_slider_reasoning>

<orthogonality>
  Sliders are independent dials, each emitting only its own nutrient. This is NOT double-counting: a fatty cut feeds proteinG via the protein slider AND fatG via the fat slider — the user sets "how much meat" and "how rich overall" separately.
</orthogonality>

<rationale>
  rationale is one warm ≤280-char line that shows you understood the occasion. No judgement, no clinical tone, no calorie scolding.
</rationale>

<clarifying_question>
  Only when the description is too vague to author sensible anchors (e.g. just "dinner out"), set clarifyingQuestion with one short question and optional answer chips, and you may emit looser/fewer sliders. Otherwise omit clarifyingQuestion. Prefer answering with sensible defaults over asking.
</clarifying_question>

<occasion>
${occasionLines.length > 0 ? `${occasionLines.join('\n')}` : '  description: (none)'}
</occasion>

<user_context>
${countryLines.length > 0 ? `${countryLines.join('\n')}\n` : ''}  oil_usage: ${cookingHabits.oilUsage}
  sugar_braised: ${cookingHabits.sugarBraised}
</user_context>`;
}
