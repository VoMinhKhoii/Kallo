import { type NextRequest, NextResponse } from 'next/server';
import { renameMyProfile } from '@/lib/actions/groups/profile';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { serializeError } from '@/lib/errors/serialize';

export const runtime = 'nodejs';

/**
 * Rename the signed-in user ("what should we call you"). The invite handle is
 * re-derived from the name server-side, so outstanding invite links change —
 * same consequence as editing the slug via `POST /api/v1/groups/profile`.
 */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = (await readJsonBody(request)) as { displayName: string };
    const profile = await renameMyProfile(actorId, body.displayName);
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}
