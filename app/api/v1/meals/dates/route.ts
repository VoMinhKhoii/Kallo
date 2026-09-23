import type { NextRequest } from 'next/server';
import { loadMealDates } from '@/lib/actions/meals/meal-dates';
import { timezoneOffsetSchema } from '@/lib/api/contracts/meals';
import { parseTzParam } from '@/lib/api/query';
import { handleRouteError } from '@/lib/api/respond';

export async function GET(req: NextRequest) {
  try {
    const timezoneOffset = timezoneOffsetSchema.parse(
      parseTzParam(req.nextUrl.searchParams.get('tz'))
    );
    const summaries = await loadMealDates({ timezoneOffset });
    // Flattened on purpose. The Flutter client reads this as
    // `list.cast<String>()`, and a shipped build cannot be updated in lockstep
    // with a web deploy, so handing it objects throws on real devices. The web
    // sidebar takes the per-day summaries from the action directly; only this
    // public surface stays a bare list of date strings.
    return Response.json(summaries.map((summary) => summary.date));
  } catch (error) {
    return handleRouteError(error);
  }
}
