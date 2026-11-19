import { KALLO_VS_CAL_AI } from './kallo-vs-cal-ai';
import { KALLO_VS_MYFITNESSPAL } from './kallo-vs-myfitnesspal';
import type { CompareSlug } from './slugs';
import type { ComparePage } from './types';

/** Every comparison page's copy, by slug. */
export const COMPARE_PAGES: Record<CompareSlug, ComparePage> = {
  'kallo-vs-cal-ai': KALLO_VS_CAL_AI,
  'kallo-vs-myfitnesspal': KALLO_VS_MYFITNESSPAL,
};

/** The comparison page for an alternatives page's app, if there is one. */
export function compareSlugFor(alternatives: string): CompareSlug | null {
  const hit = (Object.keys(COMPARE_PAGES) as CompareSlug[]).find(
    (slug) => COMPARE_PAGES[slug].alternatives === alternatives
  );
  return hit ?? null;
}
