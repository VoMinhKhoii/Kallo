import { type NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateMyProfile,
  upsertPublicProfile,
} from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { readJsonBody, requireUserId } from '../_auth';

export const runtime = 'nodejs';

/**
 * The signed-in user's own profile. Auto-provisions a shareable invite link on
 * first access (no claim step), so the response is always a profile.
 */
export async function GET() {
  try {
    const actorId = await requireUserId();
    const profile = await getOrCreateMyProfile(actorId);
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
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
    return serializeError(error);
  }
}
