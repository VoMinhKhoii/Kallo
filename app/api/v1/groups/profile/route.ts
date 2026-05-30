import { type NextRequest, NextResponse } from 'next/server';
import { getMyPublicProfile, upsertPublicProfile } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { requireUserId } from '../_auth';

export const runtime = 'nodejs';

/** The signed-in user's own public profile (handle), or null if not claimed. */
export async function GET() {
  try {
    const actorId = await requireUserId();
    const profile = await getMyPublicProfile(actorId);
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}

/** Claim or update the signed-in user's handle so friends can add them. */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const profile = await upsertPublicProfile(actorId, {
      handle: body.handle,
      displayName: body.displayName,
      avatarSeed: body.avatarSeed,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}
