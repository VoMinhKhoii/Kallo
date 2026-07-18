import { type NextRequest, NextResponse } from 'next/server';
import { createShareReplyAction } from '@/lib/actions/meal-sharing/replies';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await createShareReplyAction(
      body as { shareId: string; replyId?: string; body: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
