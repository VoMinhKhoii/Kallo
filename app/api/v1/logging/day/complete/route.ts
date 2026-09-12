import type { NextRequest } from 'next/server';
import { markDayCompleteAction } from '@/lib/actions/meals/day/mark-day-complete';
import { markDayCompleteSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';

export const runtime = 'nodejs';

/** `{ date, timezoneOffset }` and nothing else — a generous ceiling for two fields. */
const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest) {
  try {
    const body = markDayCompleteSchema.parse(
      await readBoundedJson(req, MAX_BODY_BYTES)
    );
    const result = await markDayCompleteAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
