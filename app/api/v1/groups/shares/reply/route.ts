import { type NextRequest, NextResponse } from 'next/server';
import { createShareReplyAction } from '@/lib/actions/meal-sharing/replies';
import { readJsonBody } from '@/lib/api/auth';
import { createShareReplyBodySchema } from '@/lib/api/contracts/social/share-replies';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = createShareReplyBodySchema.parse(await readJsonBody(request));
    const result = await createShareReplyAction(body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
