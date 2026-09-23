import { type NextRequest, NextResponse } from 'next/server';
import { stageCheatInviteAction } from '@/lib/actions/meal-sharing/stage-cheat-copy';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

/**
 * Take a cheat invite. Unlike its precise twin at `../accept`, this logs
 * nothing: it returns a staged analysis for the slider card to open on, and
 * the recipient confirms their own amounts through the ordinary cheat path.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = await readJsonBody(request);
    const result = await stageCheatInviteAction(body as { inviteId: string });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
