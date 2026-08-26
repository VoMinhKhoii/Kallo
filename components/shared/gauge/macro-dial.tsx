'use client';

import { GaugeDial } from '@/components/shared/gauge/gauge-dial';
import { gaugeMacroLines } from '@/components/shared/gauge/gauge-lines';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  type CompositionKey,
} from '@/components/shared/nutrition/composition';
import { gaugeMetaSize } from '@/lib/core/ui/gauge-figure-size';
import { LABEL_GAP, labelLineHeight } from '@/lib/core/ui/gauge-strip-metrics';

/**
 * One macro's dial: the same arc as the calorie dial, in that macro's pigment,
 * wearing its name.
 *
 * The glyph carries the identity. Pigment alone cannot separate three arcs this
 * small, and the beef / wheat / droplet set is already the app's macro
 * vocabulary on both platforms.
 *
 * Mirrors the `_MacroDial` inside
 * `apps/mobile-flutter/lib/shared/widgets/gauge/macro_dial_row.dart`.
 */
interface MacroDialProps {
  dialKey: CompositionKey;
  label: string;
  /** Grams eaten so far. */
  current: number;
  /** Grams the day is aiming at. */
  target: number;
  /** Sized by the strip from the room the surface gave it. */
  radius: number;
}

export function MacroDial({
  dialKey,
  label,
  current,
  target,
  radius,
}: MacroDialProps) {
  const color = COMPOSITION_COLORS[dialKey];
  const Icon = COMPOSITION_ICONS[dialKey];
  const glyph = Math.max(12, Math.round(radius * 0.3));

  return (
    <div className="flex flex-col items-center">
      {/* The title sits ON the arc, not floating above it: the dial is drawn
          with no dead space over its stroke, so one tight gap binds them. */}
      <div
        className="flex items-center gap-1.5"
        style={{ height: labelLineHeight(radius) }}
      >
        <Icon
          aria-hidden="true"
          className="shrink-0"
          style={{ color, width: glyph, height: glyph }}
        />
        <span
          className="whitespace-nowrap font-medium font-sans-display text-kallo-text-muted uppercase tracking-[0.3px]"
          style={{
            fontSize: `${gaugeMetaSize(radius)}px`,
            lineHeight: `${labelLineHeight(radius)}px`,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ marginTop: LABEL_GAP }}>
        <GaugeDial
          fill={color}
          progress={target > 0 ? current / target : 0}
          radius={radius}
          {...gaugeMacroLines(
            {
              figure: `${Math.round(current)}g`,
              target: `/${Math.round(target)}g`,
            },
            radius
          )}
        />
      </div>
    </div>
  );
}
