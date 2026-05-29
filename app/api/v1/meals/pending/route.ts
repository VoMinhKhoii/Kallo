import type { NextRequest } from 'next/server';
import { loadPendingAnalysesByDate } from '@/lib/actions/meals';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const date = dateStringSchema.parse(searchParams.get('date'));
    const timezoneOffset = timezoneOffsetSchema.parse(
      Number(searchParams.get('tz'))
    );
    const result = await loadPendingAnalysesByDate({ date, timezoneOffset });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
