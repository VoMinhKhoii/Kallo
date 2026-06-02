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
import type { LoggingDayData } from '@/lib/api/contracts/meals';
import type { getOnboardingProfile } from '@/lib/api/contracts/onboarding';
import type { WeightSummaryData } from '@/lib/api/contracts/weight';
import type { HeatmapData } from '@/lib/types/dashboard';

/**
 * Query schema for `GET /api/v1/dashboard/heatmap`. The heatmap range is the
 * wider `'30d' | '90d' | 'year'` set (distinct from the weight-summary range,
 * which omits `'year'`).
 */
export const heatmapQuerySchema = z.object({
  range: z.enum(['30d', '90d', 'year']),
  timezoneOffset: timezoneOffsetSchema,
});

export type { HeatmapData };

/**
 * Response shape for `GET /api/v1/dashboard` — the aggregate the mobile
 * dashboard fetches in ONE request instead of fanning out to
 * `/onboarding/profile` + `/logging/day` + `/weight/summary` +
 * `/dashboard/heatmap`. Each slice is the exact payload of its standalone
 * route, so the mobile client can seed the per-section query caches with it.
 * `profile` is nullable (a user who never finished onboarding has no row).
 */
export type DashboardBundle = {
  profile: Awaited<ReturnType<typeof getOnboardingProfile>>;
  day: LoggingDayData;
  weightSummary: WeightSummaryData;
  heatmap: HeatmapData;
};
