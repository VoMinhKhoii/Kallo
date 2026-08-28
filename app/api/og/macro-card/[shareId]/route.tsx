import { ImageResponse } from '@vercel/og';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';
import { canViewShareOwnedBy } from '@/lib/domain/social/shares/share-visibility';
import { db } from '@/lib/infra/db/client';
import {
  analysisGuardEvents,
  mealShares,
  meals,
  publicProfiles,
} from '@/lib/infra/db/schema';
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

// Node runtime: the route reads the DB over the Drizzle owner connection and
// the vendored font binaries off disk.
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

    // Supabase is the auth session only — every table read below goes through
    // Drizzle, because the `anon`/`authenticated` roles hold no table grants
    // (20260825120000_lock_postgrest_data_plane).
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

    const [share] = await db
      .select({
        mealId: mealShares.mealId,
        actorId: mealShares.actorId,
        sharedAt: mealShares.sharedAt,
        visibility: mealShares.visibility,
      })
      .from(mealShares)
      .where(eq(mealShares.id, shareId))
      .limit(1);
    // Drizzle bypasses RLS, so the visibility rule that used to be enforced by
    // the meal_shares SELECT policy is enforced here instead — same contract
    // (own share, or a non-private share from someone in the viewer's circle),
    // and the row is already loaded so the owner case costs no extra query.
    // A denied share and a missing one stay indistinguishable by design.
    if (!share || !(await canViewShareOwnedBy(user.id, share, db))) {
      throw Errors.notFound('Macro card not found.');
    }

    const [meal] = await db
      .select({
        rawInput: meals.rawInput,
        caloriesKcal: meals.caloriesKcal,
        proteinG: meals.proteinG,
        carbohydrateG: meals.carbohydrateG,
        fatG: meals.fatG,
        userId: meals.userId,
      })
      .from(meals)
      .where(eq(meals.id, share.mealId))
      .limit(1);
    if (!meal) {
      throw Errors.notFound('Macro card not found.');
    }

    const [profile] = await db
      .select({ avatarSeed: publicProfiles.avatarSeed })
      .from(publicProfiles)
      .where(eq(publicProfiles.userId, meal.userId))
      .limit(1);

    const macros: MacroBar[] = [
      {
        label: 'P',
        grams: toNumber(meal.proteinG),
        color: OG_COLORS.macroProtein,
      },
      {
        label: 'C',
        grams: toNumber(meal.carbohydrateG),
        color: OG_COLORS.macroCarbs,
      },
      { label: 'F', grams: toNumber(meal.fatG), color: OG_COLORS.macroFat },
    ];

    const fonts = await loadOgFonts();

    return new ImageResponse(
      <MacroCard
        calories={toNumber(meal.caloriesKcal)}
        dishName={meal.rawInput.trim() || '—'}
        macros={macros}
        swatch={dishColorFromSeed(profile?.avatarSeed ?? null)}
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
          // per shareId. The share gate above is per-viewer, so cache privately.
          'Cache-Control':
            'private, max-age=86400, stale-while-revalidate=604800, immutable',
        },
      }
    );
  } catch (error) {
    return serializeError(error);
  }
}
