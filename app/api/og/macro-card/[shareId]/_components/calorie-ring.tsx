import {
  RING_CENTER,
  RING_CIRCUMFERENCE,
  RING_RADIUS,
  RING_VIEWBOX,
  ringDashOffset,
} from '@/lib/seo/og/card-geometry';
import { OG_COLORS } from '@/lib/seo/og/palette';

/**
 * A single full track plus a fixed accent sweep, so the card reads as "logged"
 * without implying a comparison against a goal the viewer cannot see.
 */
const RING_SWEEP = 0.82;
const SIZE = 320;

/** Drawn calorie ring with the kcal figure centred inside it. */
export function CalorieRing({ calories }: { calories: number | null }) {
  return (
    <div
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
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
          stroke={OG_COLORS.track}
          strokeWidth={7}
        />
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={OG_COLORS.accent}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={ringDashOffset(RING_SWEEP)}
          transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SIZE,
          height: SIZE,
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
            color: OG_COLORS.text,
            lineHeight: 1,
          }}
        >
          {calories == null ? '—' : Math.round(calories).toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: 'DM Sans',
            fontWeight: 700,
            fontSize: 26,
            color: OG_COLORS.stone,
            letterSpacing: '0.18em',
            marginTop: 8,
          }}
        >
          KCAL
        </div>
      </div>
    </div>
  );
}
