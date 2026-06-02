import type { NextRequest } from 'next/server';
import { loadMealDates } from '@/lib/actions/meals';
import { timezoneOffsetSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const timezoneOffset = timezoneOffsetSchema.parse(
      Number(req.nextUrl.searchParams.get('tz'))
    );
    const result = await loadMealDates({ timezoneOffset });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
