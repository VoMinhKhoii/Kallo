import { type NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateMyProfile,
  upsertPublicProfile,
} from '@/lib/actions/groups/profile';
import {
  readJsonBody,
  requireUserId,
  requireUserWithAvatar,
} from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/**
 * The signed-in user's own profile. Auto-provisions a shareable invite link on
 * first access (no claim step), so the response is always a profile.
 */
export async function GET() {
  try {
    const { id, avatarUrl } = await requireUserWithAvatar();
    const profile = await getOrCreateMyProfile(id, avatarUrl);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Update the signed-in user's editable link end (slug) / display name. */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = (await readJsonBody(request)) as {
      handle: string;
      displayName?: string;
      avatarSeed?: string;
    };
    const profile = await upsertPublicProfile(actorId, {
      handle: body.handle,
      displayName: body.displayName,
      avatarSeed: body.avatarSeed,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
