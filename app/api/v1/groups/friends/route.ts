import { NextResponse } from 'next/server';
import { listCircle } from '@/lib/actions/groups/feed';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const actorId = await requireUserId();
    const circle = await listCircle(actorId);
    return NextResponse.json({ circle });
  } catch (error) {
    return handleRouteError(error);
  }
}
