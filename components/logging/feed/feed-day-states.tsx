'use client';

import { useTranslations } from 'next-intl';
import { RetryAction } from '@/components/shared/surface-state/retry-action';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { gaugeHeight } from '@/lib/core/ui/gauge-arc-geometry';
import {
  FEED_MACRO_CAP,
  gaugeStripSizes,
} from '@/lib/core/ui/gauge-strip-layout';
import {
  sizeAtCap,
  sizeStrip,
  stripHeight,
} from '@/lib/core/ui/gauge-strip-metrics';

/**
 * The height the feed's gauge strip takes at each column width, as steps from
 * the widest down: `{ maxWidth, height }` applies at or below `maxWidth`, the
 * last matching step wins, and above the first step the strip is at its cap.
 * Read off `sizeStrip` itself, so it cannot drift from the strip it reserves
 * for — the dials shrink in ~3 px steps below ~400 px and stack into two rows
 * below ~324 px (prod, 2026-10-27: 101 px at a 360 px phone, 115 px on
 * desktop, 110 px in the column beside the timeline at 1024).
 */
export function macroSummarySteps() {
  const steps: { maxWidth: number; height: number }[] = [];
  let previous = stripHeight(sizeAtCap(FEED_MACRO_CAP));
  for (let width = 800; width >= 200; width--) {
    const height = stripHeight(sizeStrip(width, FEED_MACRO_CAP));
    if (height !== previous) {
      steps.push({ maxWidth: width, height });
      previous = height;
    }
  }
  return steps;
}

const SKELETON_CLASS = 'macro-summary-skeleton';

/** Container-query rules: the placeholder takes the strip's height for the
 *  width its column actually has, on the server-rendered first paint too. */
const SKELETON_CSS = [
  `.${SKELETON_CLASS}{height:${stripHeight(sizeAtCap(FEED_MACRO_CAP))}px}`,
  ...macroSummarySteps().map(
    ({ maxWidth, height }) =>
      `@container (width < ${maxWidth + 1}px){.${SKELETON_CLASS}{height:${height}px}}`
  ),
].join('');

/**
 * The dial row's own silhouette — one wide mark for the day, three narrow ones
 * for the macros. Shaped like what it stands in for, so the header does not
 * visibly change layout when the day arrives.
 */
export function MacroSummarySkeleton() {
  // At the cap, which is what the strip settles on for any feed-width column —
  // shaped like what it stands in for, so the header does not visibly change
  // layout when the day arrives.
  const { calorieRadius, macroRadius, gap } = gaugeStripSizes(
    Number.POSITIVE_INFINITY,
    FEED_MACRO_CAP
  );

  return (
    <div
      aria-hidden="true"
      // The silhouette alone came out 17 px shorter than the strip it stands
      // for (it leaves out the readouts under each dial), so every load of the
      // logging page pushed the feed down when the day arrived (layout shift
      // 0.095 on 5 of 5 prod loads). It holds the strip's own height for the
      // column's width instead (SKELETON_CSS; the column is the container).
      className={`${SKELETON_CLASS} flex animate-pulse items-start justify-center`}
      style={{ gap }}
    >
      <style href={SKELETON_CLASS} precedence="default">
        {SKELETON_CSS}
      </style>
      <div
        className="shrink-0 rounded-full bg-kallo-track"
        style={{
          width: calorieRadius * 2,
          height: gaugeHeight(calorieRadius),
        }}
      />
      {[0, 1, 2].map((index) => (
        <div className="flex flex-col items-center gap-1" key={index}>
          <div className="h-3 w-11 rounded-full bg-kallo-border/70" />
          <div
            className="rounded-full bg-kallo-track"
            style={{
              width: macroRadius * 2,
              height: gaugeHeight(macroRadius),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function LoggingDaySkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="logging-day-skeleton"
      className="mx-auto w-full max-w-3xl"
    >
      <div className="flex animate-pulse flex-col gap-8">
        {[0, 1].map((item) => (
          <div key={item} className="relative">
            <div className="mb-2 h-3 w-16 rounded-full bg-kallo-border/70" />
            <div className="rounded-2xl border border-kallo-border/60 bg-kallo-hover/20 p-5 shadow-sm">
              <div className="mb-4 h-5 w-2/3 rounded-full bg-kallo-border/70" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-kallo-border/60" />
                <div className="h-3 w-5/6 rounded-full bg-kallo-border/50" />
                <div className="h-3 w-3/5 rounded-full bg-kallo-border/40" />
              </div>
              <div className="mt-5 flex items-center justify-between border-kallo-border/50 border-t border-dashed pt-3">
                <div className="h-3 w-28 rounded-full bg-kallo-border/50" />
                <div className="h-4 w-16 rounded-full bg-kallo-track" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoggingDayErrorStateProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function LoggingDayErrorState({
  onRetry,
  isRetrying,
}: LoggingDayErrorStateProps) {
  const t = useTranslations('logging.feedArea');

  return (
    <SurfaceState
      action={
        <RetryAction
          isRetrying={isRetrying}
          label={t('retryDay')}
          onRetry={onRetry}
        />
      }
      area="logging"
      className="flex-1"
      kind="error"
      subtitle={t('loadErrorDescription')}
      title={t('loadErrorTitle')}
    />
  );
}
