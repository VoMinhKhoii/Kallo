import type { NutritionDayScope, NutritionRangeInput } from './types';

/**
 * TanStack Query keys for the nutrition surface.
 *
 * The root segment is shared by the page that reads it and by the logging flow
 * that invalidates it after a meal is saved. Written out by hand in both, a
 * rename in one would silently stop the other from invalidating — the failure
 * mode being stale numbers on the nutrition page, which is exactly what this
 * invalidation exists to prevent.
 */
export const nutritionKeys = {
  all: ['nutrition'] as const,
  overview: (
    range: NutritionRangeInput,
    dayScope: NutritionDayScope,
    timezoneOffset: number | 'utc'
  ) =>
    [
      ...nutritionKeys.all,
      'overview',
      range,
      dayScope,
      timezoneOffset,
    ] as const,
};
