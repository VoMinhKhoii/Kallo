import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

/**
 * Which locale block-set a prompt renders with. `vi` is the original prompt
 * text byte-for-byte; `global` swaps the VN-specific blocks (naming, cooking
 * traps, portion cues, examples, density priors) for non-VN counterparts.
 */
export type PromptLocale = 'vi' | 'global';

/**
 * Single selection rule for both LLM calls: `outputLanguage` comes from
 * `decideMealLanguage` (input detection + profile/request locale fallback),
 * so Vietnamese input — including unaccented VN food words — selects `vi`,
 * English input selects `global`, and undefined (legacy callers, replay
 * without language context) keeps the original `vi` rendering.
 */
export function resolvePromptLocale(
  userContext: Pick<PromptPersonalizationContext, 'outputLanguage'>
): PromptLocale {
  return userContext.outputLanguage === 'en' ? 'global' : 'vi';
}

/**
 * Telemetry name for a locale variant: the `vi` (original) prompt keeps the
 * bare stage name so its `prompt_versions` history stays continuous; `global`
 * gets a suffix so the two variants never collapse into one version row
 * (`hashPromptBuilder` hashes builder SOURCE, identical across locales).
 */
export function promptTraceName<Base extends string>(
  base: Base,
  locale: PromptLocale
): Base | `${Base}:global` {
  return locale === 'global' ? `${base}:global` : base;
}
