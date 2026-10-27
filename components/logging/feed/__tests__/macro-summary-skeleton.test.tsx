import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MacroSummarySkeleton,
  macroSummarySteps,
} from '@/components/logging/feed/feed-day-states';
import { FEED_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import {
  sizeAtCap,
  sizeStrip,
  stripHeight,
} from '@/lib/core/ui/gauge-strip-metrics';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

// Every load of the logging page used to push the feed down 17 px when the
// day arrived (layout shift 0.095 on 5 of 5 prod loads, 2026-10-27): the
// placeholder drew the dial silhouettes only, shorter than the strip that
// replaces it. It must hold the strip's own height — the number GaugeStrip
// reserves for itself before it measures.
// Built once: the bisection behind it is what the sweep below would otherwise
// redo for each of its ~2,000 widths (Codex: 6.4 s, past the 5 s timeout).
const STEPS = macroSummarySteps();
const CAP_HEIGHT = stripHeight(sizeAtCap(FEED_MACRO_CAP));

/** What the placeholder's container-query rules resolve to at this width. */
function reservedAt(width: number) {
  let height = CAP_HEIGHT;
  for (const step of STEPS) {
    if (width < step.maxWidth) height = step.height;
  }
  return height;
}

const actual = (width: number) => stripHeight(sizeStrip(width, FEED_MACRO_CAP));

describe('MacroSummarySkeleton', () => {
  it('reserves the strip height for every column width (phones, the narrow column, desktop)', () => {
    // Quarter-pixel steps: the strip measures fractional widths (Codex, local
    // review: 320.5 px reserved the stacked 204.5 px for a 98 px strip).
    for (let width = 240; width <= 800; width += 0.25) {
      expect(reservedAt(width), `at ${width}px`).toBe(actual(width));
    }
  });

  it('switches exactly where the strip does, on both sides of every step', () => {
    for (const { maxWidth } of STEPS) {
      for (const width of [maxWidth - 0.001, maxWidth + 0.001]) {
        expect(reservedAt(width), `at ${width}px`).toBe(actual(width));
      }
    }
  });

  it('ships those heights as container-query rules on its own class', () => {
    render(<MacroSummarySkeleton />);
    const css = [...document.querySelectorAll('style')]
      .map((style) => style.textContent)
      .join('');

    expect(css).toContain(
      `.macro-summary-skeleton{height:${stripHeight(sizeAtCap(FEED_MACRO_CAP))}px}`
    );
    for (const { maxWidth, height } of STEPS) {
      expect(css).toContain(
        `@container (width < ${maxWidth}px){.macro-summary-skeleton{height:${height}px}}`
      );
    }
  });
});
