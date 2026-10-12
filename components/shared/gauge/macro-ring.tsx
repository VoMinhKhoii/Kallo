import {
  COMPOSITION_COLORS,
  type CompositionSegment,
  compositionFromGrams,
  type MacroGramsInput,
} from '@/components/shared/nutrition/composition';

/**
 * Arc paths for each macro's segment of the ring, clockwise from 12 o'clock.
 *
 * A round cap reaches `thickness / 2` past each end of its arc, so the ends are
 * pulled in by that much and the air left between two caps is exactly `gap`
 * degrees. A segment too short to survive that is omitted. Mirrors
 * `MacroRingPainter.arcs` in the Flutter app.
 */
export function macroRingArcs(
  segments: CompositionSegment[],
  size: number,
  thickness: number,
  gap: number
): { key: CompositionSegment['key']; d: string }[] {
  const r = size / 2;
  const mid = r - thickness / 2;
  const inset = ((thickness / 2 / mid) * 180) / Math.PI;
  // Degrees clockwise from 12 o'clock → SVG coordinates.
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(r + mid * Math.cos(rad)).toFixed(2)} ${(r + mid * Math.sin(rad)).toFixed(2)}`;
  };
  const out: { key: CompositionSegment['key']; d: string }[] = [];
  let at = 0;
  for (const segment of segments) {
    const sweep = (360 * segment.pct) / 100;
    const start = at + gap / 2 + inset;
    const end = at + sweep - gap / 2 - inset;
    if (end > start) {
      const large = end - start > 180 ? 1 : 0;
      out.push({
        key: segment.key,
        d: `M${point(start)}A${mid.toFixed(2)} ${mid.toFixed(2)} 0 ${large} 1 ${point(end)}`,
      });
    }
    at += sweep;
  }
  return out;
}

/**
 * A full ring split into a meal's macros by ENERGY share — protein, carbs, fat,
 * clockwise from 12 o'clock — with the calories in its middle. The dashboard
 * dial's drawing language (rounded ends, a sliver of air between neighbours)
 * closed into a circle: a meal has no target to fill toward, so the ring shows
 * what its calories are made of.
 *
 * `thickness` and `gap` are the approved canvas's knobs (12 and 2° at 128px).
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/macro_ring.dart`.
 */
export function MacroRing({
  kcal,
  grams,
  size = 128,
  thickness = 12,
  gap = 2,
  className,
}: {
  /** Null reads "—" (unknown, never 0). */
  kcal: number | null;
  grams: MacroGramsInput;
  size?: number;
  thickness?: number;
  /** Visible air between two segments, in degrees. */
  gap?: number;
  className?: string;
}) {
  const { segments } = compositionFromGrams(grams);
  const whole = segments.find((s) => s.pct >= 99.9);
  const empty = segments.every((s) => s.pct <= 0);
  const figure = kcal === null ? '—' : String(Math.round(kcal));
  const mid = size / 2 - thickness / 2;

  return (
    <div
      role="img"
      aria-label={`${figure} kcal`}
      className={className}
      style={{ position: 'relative', width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {whole || empty ? (
          // One macro is the whole meal, or nothing is known yet: a closed ring
          // with no seam rather than an arc with a gap at 12.
          <circle
            cx={size / 2}
            cy={size / 2}
            r={mid}
            fill="none"
            strokeWidth={thickness}
            stroke={
              whole ? COMPOSITION_COLORS[whole.key] : 'var(--kallo-segment)'
            }
          />
        ) : (
          macroRingArcs(segments, size, thickness, gap).map(({ key, d }) => (
            <path
              key={key}
              d={d}
              fill="none"
              stroke={COMPOSITION_COLORS[key]}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          ))
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-kallo-text">
        <span
          className="tabular-nums leading-none tracking-[-1px]"
          style={{ fontSize: Math.round(size * 0.28) }}
        >
          {figure}
        </span>
        <span className="mt-1 text-[14px] text-kallo-text-muted">kcal</span>
      </div>
    </div>
  );
}
