import type { NextRequest } from 'next/server';
import { loadCalorieAdherenceHeatmap } from '@/lib/actions/dashboard';
import { heatmapQuerySchema } from '@/lib/api/contracts/dashboard';
import { parseTzParam } from '@/lib/api/query';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const { range, timezoneOffset } = heatmapQuerySchema.parse({
      range: searchParams.get('range'),
      timezoneOffset: parseTzParam(searchParams.get('tz')),
    });
    const result = await loadCalorieAdherenceHeatmap({ range, timezoneOffset });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
