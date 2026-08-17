import type { NextRequest } from 'next/server';
import { overviewQuerySchema } from '@/lib/api/contracts/nutrition';
import { parseTzParam } from '@/lib/api/query';
import { handleRouteError } from '@/lib/api/respond';
import { getNutritionOverview } from '@/lib/domain/nutrition/actions/overview';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawTz = searchParams.get('tz');
    const { range, tz, days } = overviewQuerySchema.parse({
      range: searchParams.get('range'),
      tz: parseTzParam(rawTz),
      days: searchParams.get('days') ?? undefined,
    });
    const result = await getNutritionOverview({
      range,
      timezoneOffset: tz,
      days,
    });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
