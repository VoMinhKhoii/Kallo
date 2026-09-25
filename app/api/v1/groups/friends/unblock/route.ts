import { type NextRequest, NextResponse } from 'next/server';
import { unblockFriend } from '@/lib/actions/groups/blocks';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { unblockUserBodySchema } from '@/lib/api/contracts/social/moderation';
import { handleRouteError } from '@/lib/api/respond';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/** Lift a block the caller placed. Deletes the edge: the pair are strangers
 * again and must re-invite to reconnect. 404 when the caller did not place a
 * block on this person (including when they are the one blocked). */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Shared with block: one budget for toggling blocks.
    await assertRateLimit('friendBlock', { kind: 'user', value: actorId });
    const body = unblockUserBodySchema.parse(await readJsonBody(request));
    const result = await unblockFriend(actorId, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
