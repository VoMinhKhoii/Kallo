import { OG_COLORS } from '@/lib/seo/og/palette';
import type { MacroBar } from './macro-card';

/**
 * Macro bars — units written out, never percentages.
 *
 * Bar fill is proportional within the meal's own macro mix, a relative visual
 * only; the written-out grams beside it are the truth.
 */
export function MacroBars({ macros }: { macros: MacroBar[] }) {
  const maxGrams = Math.max(1, ...macros.map((m) => m.grams ?? 0));

  return (
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
                backgroundColor: OG_COLORS.track,
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
                color: OG_COLORS.text,
                width: 200,
              }}
            >
              {`${m.label}: ${m.grams == null ? 'N/A' : `${Math.round(m.grams)}g`}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
