/**
 * Contract for the dashboard REST surface (`/api/v1/dashboard/*`).
 *
 * Imported by both the web hooks and the mobile (React Native) client, so this
 * file must stay free of server-only / db / supabase imports. Schemas depend
 * only on `zod` and the pure `@/lib/api/contracts/common` re-exports; the
 * response type is re-exported from the pure `@/lib/types/dashboard` module.
 */
import { z } from 'zod';
import { timezoneOffsetSchema } from '@/lib/api/contracts/common';

/**
 * Query schema for `GET /api/v1/dashboard/heatmap`. The heatmap range is the
 * wider `'30d' | '90d' | 'year'` set (distinct from the weight-summary range,
 * which omits `'year'`).
 */
export const heatmapQuerySchema = z.object({
  range: z.enum(['30d', '90d', 'year']),
  timezoneOffset: timezoneOffsetSchema,
});

export type { HeatmapData } from '@/lib/types/dashboard';
