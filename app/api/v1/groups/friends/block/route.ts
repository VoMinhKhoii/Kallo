import { type NextRequest, NextResponse } from 'next/server';
import { blockFriend } from '@/lib/actions/moderation/blocks';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { blockTargetBodySchema } from '@/lib/api/contracts/social/moderation';
import { handleRouteError } from '@/lib/api/respond';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Shared with unblock: one budget for toggling blocks.
    await assertRateLimit('friendBlock', { kind: 'user', value: actorId });
    const body = blockTargetBodySchema.parse(await readJsonBody(request));
    const result = await blockFriend(actorId, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
