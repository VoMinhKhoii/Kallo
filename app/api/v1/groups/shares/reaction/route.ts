import { type NextRequest, NextResponse } from 'next/server';
import { toggleShareReactionAction } from '@/lib/actions/meal-sharing/reactions';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await toggleShareReactionAction(body as { shareId: string });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
