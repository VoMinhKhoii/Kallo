import { type NextRequest, NextResponse } from 'next/server';
import { shareMealWithFriendsAction } from '@/lib/actions/meal-sharing/share-with-friends';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

// The action self-authenticates via requireAuthAndProfile (unified Supabase
// client — Bearer for mobile, cookie for web), so the route stays a thin body
// pass-through; the Zod schema inside the action validates the shape.
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await shareMealWithFriendsAction(
      body as {
        mealId: string;
        friendUserIds: string[];
        mode: 'copy' | 'split';
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
