import { CAL_AI_ALTERNATIVES } from './cal-ai';
import { MYFITNESSPAL_ALTERNATIVES } from './myfitnesspal';
import type { AlternativeSlug } from './slugs';
import type { AlternativePage } from './types';

/** Every alternatives page's copy, by slug. */
export const ALTERNATIVE_PAGES: Record<AlternativeSlug, AlternativePage> = {
  'cal-ai': CAL_AI_ALTERNATIVES,
  myfitnesspal: MYFITNESSPAL_ALTERNATIVES,
};
