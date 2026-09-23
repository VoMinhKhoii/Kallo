import { type NextRequest, NextResponse } from 'next/server';
import { toggleShareReactionAction } from '@/lib/actions/meal-sharing/reactions';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = await readJsonBody(request);
    const result = await toggleShareReactionAction(body as { shareId: string });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
