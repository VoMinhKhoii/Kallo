import { NextResponse } from 'next/server';
import { listMealShareInvitesAction } from '@/lib/actions/meal-sharing/invites-list';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const invites = await listMealShareInvitesAction();
    return NextResponse.json({ invites });
  } catch (error) {
    return handleRouteError(error);
  }
}
