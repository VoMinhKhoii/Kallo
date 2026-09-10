import { type NextRequest, NextResponse } from 'next/server';
import { getSharedMealEntry } from '@/lib/actions/groups/thread';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';

export const runtime = 'nodejs';

/** One shared meal, for the per-post thread page. A share the caller may not
 * see answers 404 exactly as a deleted one does — the two must stay
 * indistinguishable, or the endpoint becomes a share-existence oracle. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const actorId = await requireUserId();
    const { shareId } = await params;
    const entry = await getSharedMealEntry(actorId, shareId);
    if (!entry) throw Errors.notFound('Không tìm thấy bài chia sẻ.');
    return NextResponse.json({ entry });
  } catch (error) {
    return handleRouteError(error);
  }
}
