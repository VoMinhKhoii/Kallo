import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MacroSummarySkeleton } from '@/components/logging/feed/feed-day-states';
import { FEED_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import { sizeAtCap, stripHeight } from '@/lib/core/ui/gauge-strip-metrics';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

// Every load of the logging page used to push the feed down 17 px when the
// day arrived (layout shift 0.095 on 5 of 5 prod loads, 2026-10-27): the
// placeholder drew the dial silhouettes only, shorter than the strip that
// replaces it. It must hold the strip's own height — the number GaugeStrip
// reserves for itself before it measures.
describe('MacroSummarySkeleton', () => {
  it('reserves exactly the gauge strip height at the feed cap', () => {
    const { container } = render(<MacroSummarySkeleton />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.height).toBe(
      `${stripHeight(sizeAtCap(FEED_MACRO_CAP))}px`
    );
  });
});
