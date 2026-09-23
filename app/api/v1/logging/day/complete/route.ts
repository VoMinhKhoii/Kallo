import type { NextRequest } from 'next/server';
import { markDayCompleteAction } from '@/lib/actions/meals/day/mark-day-complete';
import { markDayCompleteSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';

/** `{ date, timezoneOffset }` and nothing else — a generous ceiling for two fields. */
const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = markDayCompleteSchema.parse(
      await readBoundedJson(req, MAX_BODY_BYTES)
    );
    const result = await markDayCompleteAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
