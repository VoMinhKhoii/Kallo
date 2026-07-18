import { type NextRequest, NextResponse } from 'next/server';
import { logSharedMealAction } from '@/lib/actions/meal-sharing/log-shared';
import { readJsonBody } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await logSharedMealAction(
      body as {
        shareId: string;
        factor: 1 | 0.5;
        loggedDate: string;
        timezoneOffset: number;
        newMealId?: string;
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
