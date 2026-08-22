/**
 * The readout lines the app's dials draw, each pairing its classes with the
 * height they resolve to.
 *
 * Stated together because `gaugeReadoutLayout` measures the stack before the
 * browser lays it out, and the line is then rendered at exactly this
 * line-height — split the number from the classes and the two drift, which
 * slides every line below it off the arc's tips.
 */

export interface GaugeLine {
  text: string;
  className: string;
  heightPx: number;
}

const LINES = {
  /** The dashboard's one hero figure per card. */
  hero: {
    className: 'font-sans-display text-hero text-kallo-text tabular-nums',
    heightPx: 44,
  },
  /** The embedded dial's headline, and the macro dials' gram figure. */
  value: {
    className:
      'font-sans-display font-semibold text-kallo-text text-sm tabular-nums',
    heightPx: 20,
  },
  /** What the headline is — the line that lands on the tips. Words, not
   *  figures, so it is the one line without tabular numerals. */
  body: {
    className: 'font-sans-display text-kallo-text-muted text-sm',
    heightPx: 20,
  },
  /** The quiet detail under the arc, and the macro dials' `/target`. */
  meta: {
    className: 'font-sans-display text-kallo-text-muted text-xs tabular-nums',
    heightPx: 16,
  },
} as const;

export type GaugeLineStyle = keyof typeof LINES;

/** Build a readout line from one of the named styles above. */
export function gaugeLine(style: GaugeLineStyle, text: string): GaugeLine {
  return { ...LINES[style], text };
}
