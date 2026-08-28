import { type NextRequest, NextResponse } from 'next/server';
import { markRead } from '@/lib/actions/notifications/state';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { markReadBodySchema } from '@/lib/domain/notifications/contracts';

export const runtime = 'nodejs';

/** Per-row dim on tap. Ids the caller does not own are silently no-ops — the
 *  action scopes every write to the recipient. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = markReadBodySchema.parse(await readJsonBody(request));
    const result = await markRead(userId, body.ids);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
