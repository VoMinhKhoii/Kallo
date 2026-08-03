import type { NextRequest } from 'next/server';
import { relogMealItemsAction } from '@/lib/actions/meals/relog/relog-items';
import { relogItemsSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';

export const runtime = 'nodejs';

/** `POST /api/v1/meals/relog` — commit staged relog references as one meal.
 *  Exists for the Flutter client; the web composer calls the Server Action
 *  directly. The body carries only references, never nutrition. */
export async function POST(req: NextRequest) {
  try {
    await requireAuthAndProfile();

    const body = relogItemsSchema.parse(await req.json());
    const result = await relogMealItemsAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
