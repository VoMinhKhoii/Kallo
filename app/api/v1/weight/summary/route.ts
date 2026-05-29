import type { NextRequest } from 'next/server';
import { loadWeightSummaryAction } from '@/lib/actions/weight';
import { weightSummaryQuerySchema } from '@/lib/api/contracts/weight';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const { range, timezoneOffset } = weightSummaryQuerySchema.parse({
      range: searchParams.get('range'),
      timezoneOffset: Number(searchParams.get('tz')),
    });
    const result = await loadWeightSummaryAction({ range, timezoneOffset });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
