import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';
import {
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/infra/rate-limit/analysis-guards';
import { getRequestIp } from '@/lib/infra/security/request-ip';
import { createClient } from '@/lib/infra/supabase/server';
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/seo/og/card-geometry';
import { loadOgFonts } from '@/lib/seo/og/fonts';
import { dishColorFromSeed, OG_COLORS } from '@/lib/seo/og/palette';
import { type MacroBar, MacroCard } from './_components/macro-card';

// Node runtime: the route reads the DB (RLS-gated via the user's Supabase
// session) and the vendored font binaries off disk.
export const runtime = 'nodejs';

const ogRoute = '/api/og/macro-card';

// Per-user OG render guard. The card is CPU-heavy, so reuse the existing
// analysis rate-limit windows/table with a generous-but-bounded cap.
const OG_RATE_LIMIT = {
  perUserMinute: 10,
  perUserHour: 60,
  perUserDay: 200,
  // The render itself is stateless — no in-flight slot to hold.
  concurrentUser: Number.MAX_SAFE_INTEGER,
} as const;

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(shareId)) {
      throw Errors.notFound('Macro card not found.');
    }

    // Auth + RLS-gated read share the same Supabase session client. RLS on
    // meal_shares/meals only returns rows the viewer is allowed to see (own
    // meal, or an accepted friend's 'circle' share, or an active coach's
    // client) — an unauthorized or unshared shareId resolves to no row.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw Errors.notAuthenticated();
    }

    const guard = await checkAnalysisGuards({
      userId: user.id,
      ip: getRequestIp(request),
      route: ogRoute,
      limits: OG_RATE_LIMIT,
    });
    if (!guard.allowed) {
      // Best-effort guard event log (non-fatal).
      try {
        const { db } = await import('@/lib/infra/db/client');
        const { analysisGuardEvents } = await import('@/lib/infra/db/schema');
        await db.insert(analysisGuardEvents).values(
          buildAnalysisGuardEvent({
            userId: user.id,
            ip: getRequestIp(request),
            route: ogRoute,
            reason: guard.reason,
            retryAfterSeconds: guard.retryAfterSeconds,
          })
        );
      } catch {
        // ignore logging failures
      }
      return serializeError(
        Errors.rateLimited(undefined, guard.retryAfterSeconds)
      );
    }

    const { data: share } = await supabase
      .from('meal_shares')
      .select('id, meal_id, actor_id')
      .eq('id', shareId)
      .maybeSingle();
    if (!share) {
      // RLS denied, or the share does not exist — indistinguishable by design.
      throw Errors.notFound('Macro card not found.');
    }

    const { data: meal } = await supabase
      .from('meals')
      .select(
        'raw_input, calories_kcal, protein_g, carbohydrate_g, fat_g, user_id'
      )
      .eq('id', share.meal_id)
      .maybeSingle();
    if (!meal) {
      throw Errors.notFound('Macro card not found.');
    }

    const { data: profile } = await supabase
      .from('public_profiles')
      .select('avatar_seed')
      .eq('user_id', meal.user_id)
      .maybeSingle();

    const macros: MacroBar[] = [
      {
        label: 'P',
        grams: toNumber(meal.protein_g),
        color: OG_COLORS.macroProtein,
      },
      {
        label: 'C',
        grams: toNumber(meal.carbohydrate_g),
        color: OG_COLORS.macroCarbs,
      },
      { label: 'F', grams: toNumber(meal.fat_g), color: OG_COLORS.macroFat },
    ];

    const fonts = await loadOgFonts();

    return new ImageResponse(
      <MacroCard
        calories={toNumber(meal.calories_kcal)}
        dishName={(meal.raw_input as string)?.trim() || '—'}
        macros={macros}
        swatch={dishColorFromSeed(profile?.avatar_seed ?? null)}
      />,
      {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: [
          { name: 'Lora', data: fonts.lora, weight: 400, style: 'normal' },
          { name: 'DM Sans', data: fonts.dmSans, weight: 700, style: 'normal' },
        ],
        headers: {
          // Card text is fixed once the meal is saved, so the PNG is immutable
          // per shareId. RLS still gates the upstream read, so cache privately.
          'Cache-Control':
            'private, max-age=86400, stale-while-revalidate=604800, immutable',
        },
      }
    );
  } catch (error) {
    return serializeError(error);
  }
}
