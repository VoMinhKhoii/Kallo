import { KALLO_WORDMARK_D, KALLO_WORDMARK_VIEWBOX } from '@/lib/brand/kallo';
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/seo/og/card-geometry';
import { OG_COLORS } from '@/lib/seo/og/palette';
import { CalorieRing } from './calorie-ring';
import { MacroBars } from './macro-bars';

/**
 * The 9:16 share card, drawn by Satori — not a browser. Two rules apply to
 * every element below: any element with 2+ children needs an explicit
 * `display: 'flex'`, and colours must be literal (see `lib/seo/og/palette.ts`).
 */

export interface MacroBar {
  label: string;
  grams: number | null;
  color: string;
}

interface MacroCardProps {
  dishName: string;
  calories: number | null;
  macros: MacroBar[];
  /** Per-user accent, from `dishColorFromSeed`. */
  swatch: string;
}

export function MacroCard({
  dishName,
  calories,
  macros,
  swatch,
}: MacroCardProps) {
  return (
    <div
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: OG_COLORS.surface,
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
          fill={OG_COLORS.text}
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
            color: OG_COLORS.text,
          }}
        >
          {dishName}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          <CalorieRing calories={calories} />
          <MacroBars macros={macros} />
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
            backgroundColor: OG_COLORS.border,
          }}
        />
        <div
          style={{
            fontFamily: 'DM Sans',
            fontSize: 30,
            color: OG_COLORS.textMuted,
            letterSpacing: '0.02em',
          }}
        >
          Logged with Kallo
        </div>
      </div>
    </div>
  );
}
