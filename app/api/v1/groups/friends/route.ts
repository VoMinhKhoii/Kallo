import { NextResponse } from 'next/server';
import { listCircle } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { requireUserId } from '../_auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const actorId = await requireUserId();
    const circle = await listCircle(actorId);
    return NextResponse.json({ circle });
  } catch (error) {
    return serializeError(error);
  }
}
