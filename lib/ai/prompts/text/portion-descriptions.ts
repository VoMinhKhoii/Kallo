import type {
  ProteinPortion,
  RicePortion,
} from '@/lib/domain/onboarding/types';

/**
 * User-facing portion descriptions interpolated into LLM prompts.
 *
 * Rice sizes are derived from the user's bowl of rice (`riceBowlFor`)
 * rather than restated, so the legacy prompts quote the same bowl as v2.
 */
export function ricePortionDescription(
  portion: RicePortion,
  riceBowlMidG: number
): string {
  const g = (bowls: number) => Math.round(riceBowlMidG * bowls);
  switch (portion) {
    case 'small':
      return `~1 small bowl (~${g(0.7)}–${g(0.8)}g cooked rice)`;
    case 'medium':
      return `~1 bowl (~${g(1)}g cooked rice)`;
    case 'large':
      return `~1.5–2 bowls (~${g(1.5)}–${g(2)}g cooked rice)`;
  }
}

export const PROTEIN_PORTION_DESCRIPTION: Record<ProteinPortion, string> = {
  small: 'smaller than palm, ~2-3 eggs (~80g cooked)',
  medium: 'about palm-sized (~120g cooked)',
  large: 'bigger than palm, e.g. a chicken thigh (~160g cooked)',
};
