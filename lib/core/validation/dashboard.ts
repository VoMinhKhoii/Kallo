/** Request schemas for the dashboard's heatmap. */
import { z } from 'zod';

/** The longest trailing heatmap span: 53 week columns. */
export const MAX_HEATMAP_DAYS = 371;

/**
 * A heatmap window: `'year'` (the calendar year) or `'<N>d'`, the last N days
 * ending today, 1..[MAX_HEATMAP_DAYS]. Older clients only ever send `'30d'`,
 * `'90d'` or `'year'`, which this still accepts unchanged.
 */
export const heatmapRangeSchema = z.union([
  z.literal('year'),
  z.templateLiteral([z.number().int(), 'd']).refine((range) => {
    const days = Number.parseInt(range, 10);
    return days >= 1 && days <= MAX_HEATMAP_DAYS;
  }, `A day range must be 1 to ${MAX_HEATMAP_DAYS} days.`),
]);
