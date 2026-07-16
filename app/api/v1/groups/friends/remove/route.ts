import { type NextRequest, NextResponse } from 'next/server';
import { removeFriend } from '@/lib/actions/groups/friendship';
import { serializeError } from '@/lib/errors';
import { readJsonBody, requireUserId } from '../../_auth';

export const runtime = 'nodejs';

/** Remove a connection (deletes the edge; the pair can re-invite later). */
export async function DELETE(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const result = await removeFriend(
      actorId,
      body as { targetUserId: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
