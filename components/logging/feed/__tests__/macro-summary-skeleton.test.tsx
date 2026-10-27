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
/** What the placeholder's container-query rules resolve to at this width. */
function reservedAt(width: number) {
  let height = stripHeight(sizeAtCap(FEED_MACRO_CAP));
  for (const step of macroSummarySteps()) {
    if (width < step.maxWidth + 1) height = step.height;
  }
  return height;
}

describe('MacroSummarySkeleton', () => {
  it('reserves the strip height for every column width (phones, the narrow column, desktop)', () => {
    for (let width = 240; width <= 800; width++) {
      expect(reservedAt(width), `at ${width}px`).toBe(
        stripHeight(sizeStrip(width, FEED_MACRO_CAP))
      );
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
    for (const { maxWidth, height } of macroSummarySteps()) {
      expect(css).toContain(
        `@container (width < ${maxWidth + 1}px){.macro-summary-skeleton{height:${height}px}}`
      );
    }
  });
});
