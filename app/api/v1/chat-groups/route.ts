import { type NextRequest, NextResponse } from 'next/server';
import { createChatGroup, listMyChatGroups } from '@/lib/actions/chat-groups';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { timezoneOffsetSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Validate the URL param at the boundary; fall back to UTC on garbage
    // input rather than letting NaN reach the day-window math.
    const parsedOffset = timezoneOffsetSchema.safeParse(
      Number(request.nextUrl.searchParams.get('timezoneOffset'))
    );
    const timezoneOffset = parsedOffset.success ? parsedOffset.data : 0;
    const groups = await listMyChatGroups(actorId, { timezoneOffset });
    return NextResponse.json({ groups });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    const body = await readJsonBody(request);
    const group = await createChatGroup(
      actorId,
      body as { name: string; memberUserIds: string[] }
    );
    return NextResponse.json({ group });
  } catch (error) {
    return handleRouteError(error);
  }
}
