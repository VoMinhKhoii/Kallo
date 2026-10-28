/**
 * Contract for the dashboard REST surface (`/api/v1/dashboard/*`).
 *
 * Imported by both the web hooks and the mobile (React Native) client, so this
 * file must stay free of server-only / db / supabase imports. Schemas depend
 * only on `zod` and the pure `@/lib/core/validation/primitives` validators; the
 * response type is re-exported from the pure `@/lib/core/types/dashboard` module.
 */
import { z } from 'zod';
import type { LoggingDayData } from '@/lib/api/contracts/meals';
import type { getOnboardingProfile } from '@/lib/api/contracts/onboarding';
import type { WeightSummaryData } from '@/lib/api/contracts/weight';
import type { HeatmapData } from '@/lib/core/types/dashboard';
import { heatmapRangeSchema } from '@/lib/core/validation/dashboard';
import { timezoneOffsetSchema } from '@/lib/core/validation/primitives';

/**
 * Query schema for `GET /api/v1/dashboard/heatmap`. The heatmap range is
 * `'year'` or the last N days (`'30d'`, `'90d'`, `'140d'`…), wider than the
 * weight-summary range, which is `'30d' | '90d'` only.
 */
export const heatmapQuerySchema = z.object({
  range: heatmapRangeSchema,
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
