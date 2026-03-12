import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createGeminiClient } from '@/lib/ai/gemini';
import { buildUserContext, toParsedMeal } from '@/lib/ai/mappers';
import { analyzeMeal } from '@/lib/ai/pipeline';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

const messageSchema = z
  .string()
  .min(1, 'Message is required')
  .max(500, 'Message is too long');

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to analyze meals.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = messageSchema.safeParse(body?.message);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const profile = rows[0];
    if (!profile?.goal || !profile?.regionalProfile) {
      return NextResponse.json(
        { error: 'Please complete onboarding before analyzing meals.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 500 }
      );
    }

    const gemini = createGeminiClient(apiKey);
    const result = await analyzeMeal(
      parsed.data,
      buildUserContext(profile),
      db,
      gemini
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        non_food_input: 400,
        parse_error: 500,
        api_error: 500,
      };
      return NextResponse.json(
        { error: result.error.message },
        { status: statusMap[result.error.type] ?? 500 }
      );
    }

    return NextResponse.json(toParsedMeal(result.data));
  } catch (error) {
    console.error('Chat API error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to process meal';
    const isRateLimit = errorMessage.includes('429');

    return NextResponse.json(
      {
        error: isRateLimit
          ? 'Rate limited — please wait a moment and try again'
          : 'Failed to process meal',
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
