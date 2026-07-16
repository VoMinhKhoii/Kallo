import { type NextRequest, NextResponse } from 'next/server';
import { dismissMealShareInviteAction } from '@/lib/actions/meal-sharing';
import { serializeError } from '@/lib/errors';
import { readJsonBody } from '../../_auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await dismissMealShareInviteAction(
      body as { inviteId: string }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
