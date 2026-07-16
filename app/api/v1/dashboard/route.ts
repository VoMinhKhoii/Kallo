import type { NextRequest } from 'next/server';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';
import { loadLoggingDay } from '@/lib/actions/meals/load-meals';
import { loadWeightSummaryAction } from '@/lib/actions/weight';
import type { DashboardBundle } from '@/lib/api/contracts/dashboard';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/api/contracts/meals';
import { parseTzParam } from '@/lib/api/query';
import { handleRouteError } from '@/lib/api/respond';
import { getOnboardingProfile } from '@/lib/onboarding/actions';

export const runtime = 'nodejs';

/**
 * Aggregate dashboard endpoint. Collapses the mobile dashboard's four-way
 * fan-out (`/onboarding/profile`, `/logging/day`, `/weight/summary`,
 * `/dashboard/heatmap`) into ONE request — one HTTP round-trip and one
 * Cloud-Run cold-start instead of four. The four underlying loaders run in
 * parallel and each returns the SAME payload as its standalone route, so the
 * mobile client seeds the per-section query caches with the result.
 *
 * Ranges are fixed to what the phone-width dashboard renders (weight 30d,
 * heatmap 90d), matching `WeightChart`/`AdherenceHeatmap`.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const date = dateStringSchema.parse(searchParams.get('date'));
    const timezoneOffset = timezoneOffsetSchema.parse(
      parseTzParam(searchParams.get('tz'))
    );

    const [profile, day, weightSummary, heatmap] = await Promise.all([
      getOnboardingProfile(),
      loadLoggingDay({ date, timezoneOffset }),
      loadWeightSummaryAction({ range: '30d', timezoneOffset }),
      loadCalorieAdherenceHeatmap({ range: '90d', timezoneOffset }),
    ]);

    const bundle: DashboardBundle = { profile, day, weightSummary, heatmap };
    return Response.json(bundle);
  } catch (error) {
    return handleRouteError(error);
  }
}
