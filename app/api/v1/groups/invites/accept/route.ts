import { type NextRequest, NextResponse } from 'next/server';
import { acceptMealShareInviteAction } from '@/lib/actions/meal-sharing';
import { serializeError } from '@/lib/errors';
import { readJsonBody } from '../../_auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await acceptMealShareInviteAction(
      body as {
        inviteId: string;
        newMealId?: string;
        loggedDate: string;
        timezoneOffset: number;
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
