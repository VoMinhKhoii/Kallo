import { type NextRequest, NextResponse } from 'next/server';
import { searchByHandle } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { requireUserId } from '../../_auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const handle = request.nextUrl.searchParams.get('handle') ?? '';
    const profile = await searchByHandle(actorId, { handle });
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}
