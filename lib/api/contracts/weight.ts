/**
 * Contract for the weight REST surface (`/api/v1/weight/*`).
 *
 * Imported by both the web hooks and the mobile (React Native) client, so this
 * file must stay free of server-only / db / supabase imports. Schemas depend
 * only on `zod` and the pure `@/lib/validation/*` validators; the response type
 * is re-exported from the pure `@/lib/types/weight` module.
 */
import { z } from 'zod';
import { timezoneOffsetSchema } from '@/lib/validation/primitives';

/** Body schema for `POST /api/v1/weight` (re-export of the shared validator). */
export { weightLogSchema } from '@/lib/validation/weight';

/**
 * Query schema for `GET /api/v1/weight/summary`. The weight-summary range is
 * `'30d' | '90d'` ONLY (no `'year'`, unlike the dashboard heatmap range).
 */
export const weightSummaryQuerySchema = z.object({
  range: z.enum(['30d', '90d']),
  timezoneOffset: timezoneOffsetSchema,
});

export type { WeightSummaryData } from '@/lib/types/weight';
