import { RICE_BOWL_G } from '@/lib/ai/portion/data/priors';
import type {
  ProteinPortion,
  RicePortion,
} from '@/lib/domain/onboarding/types';

/**
 * User-facing portion descriptions interpolated into LLM prompts.
 *
 * Rice sizes are derived from RICE_BOWL_G rather than restated, so every
 * prompt quotes the same bowl size as the table (120 g cooked since
 * 2026-10-22).
 */
const riceBowlMidG = RICE_BOWL_G.mid;

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
