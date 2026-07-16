import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from '@vercel/og';
import { type NextRequest, NextResponse } from 'next/server';
import { KALLO_WORDMARK_D, KALLO_WORDMARK_VIEWBOX } from '@/lib/brand/kallo';
import { Errors, serializeError } from '@/lib/errors';
import {
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/rate-limit/analysis-guards';
import { createClient } from '@/lib/supabase/server';

// Node runtime: the route reads the DB (RLS-gated via the user's Supabase
// session) and the vendored font binaries off disk.
export const runtime = 'nodejs';

const ogRoute = '/api/og/macro-card';

// 9:16 vertical card (Stories / Reels aspect).
const CARD_W = 1080;
const CARD_H = 1920;

// Reuse the calorie-ring geometry from components/shared/calorie-ring.tsx so
// the shared card matches the in-app ring exactly. (Inlined as plain SVG —
// satori cannot render the motion/CSS-variable React component.)
const RING_VIEWBOX = 100;
const RING_RADIUS = 46;
const RING_CENTER = RING_VIEWBOX / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Kallo warm palette (from app/globals.css :root — satori needs literal hex).
const NHAM_SURFACE = '#fefbf6';
const NHAM_TEXT = '#2c2416';
const NHAM_TEXT_MUTED = '#8b7355';
const NHAM_ACCENT = '#c9a87c';
const NHAM_BORDER = '#e8d5b5';
const NHAM_TRACK = '#f5f4f0';
const NHAM_STONE = '#a8a29e';
const NHAM_MACRO_PROTEIN = '#c9a87c';
const NHAM_MACRO_CARBS = '#8b7355';
const NHAM_MACRO_FAT = '#a8a29e';

// Per-user OG render guard. The card is CPU-heavy, so reuse the existing
// analysis rate-limit windows/table with a generous-but-bounded cap.
const OG_RATE_LIMIT = {
  perUserMinute: 10,
  perUserHour: 60,
  perUserDay: 200,
  // The render itself is stateless — no in-flight slot to hold.
  concurrentUser: Number.MAX_SAFE_INTEGER,
} as const;

let fontCache: Promise<{ lora: ArrayBuffer; dmSans: ArrayBuffer }> | null =
  null;

async function loadFonts() {
  fontCache ??= (async () => {
    const dir = join(process.cwd(), 'app/api/og/macro-card/_fonts');
    const [lora, dmSans] = await Promise.all([
      readFile(join(dir, 'Lora-Regular.ttf')),
      readFile(join(dir, 'DMSans-Bold.ttf')),
    ]);
    return {
      lora: lora.buffer.slice(
        lora.byteOffset,
        lora.byteOffset + lora.byteLength
      ) as ArrayBuffer,
      dmSans: dmSans.buffer.slice(
        dmSans.byteOffset,
        dmSans.byteOffset + dmSans.byteLength
      ) as ArrayBuffer,
    };
  })();
  return fontCache;
}

/**
 * Deterministic warm dish-color swatch seeded from the same avatar_seed that
 * feeds the initials avatar — gives each card a distinct appetite-toned accent
 * with zero photography. Hue is constrained to the warm 20–55° band so it
 * always reads on-brand against the cream surface.
 */
function dishColorFromSeed(seed: string | null): string {
  const source = seed && seed.length > 0 ? seed : 'nham';
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  const hue = 20 + (Math.abs(hash) % 36); // 20°–55° (amber → terracotta)
  return `hsl(${hue}, 46%, 58%)`;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function getRequestIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  return forwardedIp || request.headers.get('x-real-ip');
}

interface MacroBar {
  label: string;
  grams: number | null;
  color: string;
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
        const { db } = await import('@/lib/db');
        const { analysisGuardEvents } = await import('@/lib/db/schema');
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
      return NextResponse.json(Errors.rateLimited().toJSON(), {
        status: 429,
        headers: { 'Retry-After': String(guard.retryAfterSeconds) },
      });
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

    const dishName = (meal.raw_input as string)?.trim() || '—';
    const calories = toNumber(meal.calories_kcal);
    const swatch = dishColorFromSeed(profile?.avatar_seed ?? null);

    const macros: MacroBar[] = [
      {
        label: 'P',
        grams: toNumber(meal.protein_g),
        color: NHAM_MACRO_PROTEIN,
      },
      {
        label: 'C',
        grams: toNumber(meal.carbohydrate_g),
        color: NHAM_MACRO_CARBS,
      },
      { label: 'F', grams: toNumber(meal.fat_g), color: NHAM_MACRO_FAT },
    ];
    // Bar fill is proportional within the meal's own macro mix — a relative
    // visual only; the written-out grams are the truth. Never a percentage.
    const maxGrams = Math.max(1, ...macros.map((m) => m.grams ?? 0));

    const fonts = await loadFonts();

    // Drawn calorie ring: a single full track + a fixed accent sweep (≈82%) so
    // the card reads as "logged" without implying a goal comparison.
    const ringSweep = 0.82;
    const dashOffset = RING_CIRCUMFERENCE * (1 - ringSweep);

    return new ImageResponse(
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: NHAM_SURFACE,
          padding: '120px 96px',
          fontFamily: 'DM Sans',
        }}
      >
        {/* Top: wordmark + dish swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: swatch,
            }}
          />
          <svg
            width={118}
            height={44}
            viewBox={KALLO_WORDMARK_VIEWBOX}
            fill={NHAM_TEXT}
          >
            <path d={KALLO_WORDMARK_D} />
          </svg>
        </div>

        {/* Middle: dish name + calorie ring */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Lora',
              fontSize: dishName.length > 40 ? 84 : 110,
              lineHeight: 1.15,
              color: NHAM_TEXT,
            }}
          >
            {dishName}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
            {/* Calorie ring */}
            <div
              style={{
                position: 'relative',
                width: 320,
                height: 320,
                display: 'flex',
              }}
            >
              <svg
                width="320"
                height="320"
                viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
              >
                <circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={NHAM_TRACK}
                  strokeWidth={7}
                />
                <circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={NHAM_ACCENT}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 320,
                  height: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'DM Sans',
                    fontWeight: 700,
                    fontSize: 90,
                    color: NHAM_TEXT,
                    lineHeight: 1,
                  }}
                >
                  {calories == null
                    ? '—'
                    : Math.round(calories).toLocaleString()}
                </div>
                <div
                  style={{
                    fontFamily: 'DM Sans',
                    fontWeight: 700,
                    fontSize: 26,
                    color: NHAM_STONE,
                    letterSpacing: '0.18em',
                    marginTop: 8,
                  }}
                >
                  KCAL
                </div>
              </div>
            </div>

            {/* Macro bars — units written out, never percentages */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 36,
                flex: 1,
              }}
            >
              {macros.map((m) => {
                const pct = m.grams == null ? 0 : (m.grams / maxGrams) * 100;
                return (
                  <div
                    key={m.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 28 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        height: 14,
                        flex: 1,
                        borderRadius: 999,
                        backgroundColor: NHAM_TRACK,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: 14,
                          borderRadius: 999,
                          backgroundColor: m.color,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: 'DM Sans',
                        fontWeight: 700,
                        fontSize: 38,
                        color: NHAM_TEXT,
                        width: 200,
                      }}
                    >
                      {`${m.label}: ${m.grams == null ? 'N/A' : `${Math.round(m.grams)}g`}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: hairline + caption */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              height: 1,
              backgroundColor: NHAM_BORDER,
            }}
          />
          <div
            style={{
              fontFamily: 'DM Sans',
              fontSize: 30,
              color: NHAM_TEXT_MUTED,
              letterSpacing: '0.02em',
            }}
          >
            Logged with Kallo
          </div>
        </div>
      </div>,
      {
        width: CARD_W,
        height: CARD_H,
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
