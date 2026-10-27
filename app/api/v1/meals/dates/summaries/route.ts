import type { NextRequest } from 'next/server';
import { loadMealDates } from '@/lib/actions/meals/meal-dates';
import { timezoneOffsetSchema } from '@/lib/api/contracts/meals';
import { parseTzParam } from '@/lib/api/query';
import { handleRouteError } from '@/lib/api/respond';

/** The per-day summaries (`{ date, kcal }`) the web timeline draws. A sibling
 *  of `/api/v1/meals/dates`, whose bare-string shape is frozen for shipped
 *  mobile builds. A GET, not a Server Action: the browser runs actions one at
 *  a time, so a page's reads queued behind each other. */
export async function GET(req: NextRequest) {
  try {
    const timezoneOffset = timezoneOffsetSchema.parse(
      parseTzParam(req.nextUrl.searchParams.get('tz'))
    );
    return Response.json(await loadMealDates({ timezoneOffset }));
  } catch (error) {
    return handleRouteError(error);
  }
}
