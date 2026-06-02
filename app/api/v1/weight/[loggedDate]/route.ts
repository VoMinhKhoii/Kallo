import type { NextRequest } from 'next/server';
import { deleteWeightLogAction } from '@/lib/actions/weight';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ loggedDate: string }> }
) {
  try {
    const { loggedDate } = await params;
    const result = await deleteWeightLogAction({ loggedDate });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
