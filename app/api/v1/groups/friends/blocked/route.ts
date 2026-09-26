import { NextResponse } from 'next/server';
import { listBlockedUsers } from '@/lib/actions/moderation/blocks';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

/** The people the caller has blocked, newest first. Never lists someone who
 * blocked the caller. */
export async function GET() {
  try {
    const actorId = await requireUserId();
    const blocked = await listBlockedUsers(actorId);
    return NextResponse.json({ blocked });
  } catch (error) {
    return handleRouteError(error);
  }
}
