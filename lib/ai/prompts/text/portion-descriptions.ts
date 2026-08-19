import { PORTION_PRIORS } from '@/lib/ai/portion/data/priors';
import type {
  ProteinPortion,
  RicePortion,
} from '@/lib/domain/onboarding/types';

/**
 * User-facing portion descriptions interpolated into LLM prompts.
 *
 * Rice sizes are derived from PORTION_PRIORS rather than restated, so the
 * number the prompt tells the model matches the anchor the resolver will use.
 */
const riceBowlPrior = PORTION_PRIORS.find(
  (prior) =>
    prior.conceptId === 'cooked-rice' &&
    prior.unitType === 'container' &&
    prior.form === 'cooked'
);
const riceBowlMidG = riceBowlPrior?.perUnit.mid ?? 200;

export const RICE_PORTION_DESCRIPTION: Record<RicePortion, string> = {
  small: `~1 small bowl (~${riceBowlMidG * 0.7}–${riceBowlMidG * 0.8}g cooked rice)`,
  medium: `~1 bowl (~${riceBowlMidG}g cooked rice)`,
  large: `~1.5–2 bowls (~${riceBowlMidG * 1.5}–${riceBowlMidG * 2}g cooked rice)`,
};

export const PROTEIN_PORTION_DESCRIPTION: Record<ProteinPortion, string> = {
  small: 'smaller than palm, ~2-3 eggs (~80g cooked)',
  medium: 'about palm-sized (~120g cooked)',
  large: 'bigger than palm, e.g. a chicken thigh (~160g cooked)',
};
