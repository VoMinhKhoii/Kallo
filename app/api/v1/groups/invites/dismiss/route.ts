import { type NextRequest, NextResponse } from 'next/server';
import { dismissMealShareInviteAction } from '@/lib/actions/meal-sharing/invite-response';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await dismissMealShareInviteAction(
      body as { inviteId: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
