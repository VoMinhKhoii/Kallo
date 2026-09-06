import { type NextRequest, NextResponse } from 'next/server';
import { markSeen } from '@/lib/actions/notifications/state';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { markSeenBodySchema } from '@/lib/domain/notifications/contracts';

export const runtime = 'nodejs';

/** Bulk badge clear, fired once when the Activity page has its first page. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = markSeenBodySchema.parse(await readJsonBody(request));
    const result = await markSeen(userId, body.before);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
