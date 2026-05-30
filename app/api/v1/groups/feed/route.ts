import { type NextRequest, NextResponse } from 'next/server';
import { listCircleFeed } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { requireUserId } from '../_auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const raw = request.nextUrl.searchParams.get('timezoneOffset');
    const timezoneOffset = Number(raw ?? '0');
    const feed = await listCircleFeed(actorId, { timezoneOffset });
    return NextResponse.json({ feed });
  } catch (error) {
    return serializeError(error);
  }
}
