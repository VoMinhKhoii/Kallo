import { NextResponse } from 'next/server';
import { countUnseen } from '@/lib/actions/notifications/state';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** The 30-second badge poll — deliberately the cheapest endpoint we have. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const unseen = await countUnseen(userId);
    return NextResponse.json({ unseen });
  } catch (error) {
    return handleRouteError(error);
  }
}
