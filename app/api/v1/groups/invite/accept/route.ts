import { type NextRequest, NextResponse } from 'next/server';
import { acceptInvite } from '@/lib/actions/groups';
import { serializeError } from '@/lib/errors';
import { readJsonBody, requireUserId } from '../../_auth';

export const runtime = 'nodejs';

/** Accept a link invite (the recipient's tap connects them to the inviter). */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const result = await acceptInvite(actorId, body as { slug: string });
    return NextResponse.json(result);
  } catch (error) {
    return serializeError(error);
  }
}
