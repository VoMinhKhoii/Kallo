import { cn } from '@/lib/utils';

export type PipelineStatus = 'success' | 'error' | 'pending' | 'skipped';

/**
 * Single source of truth for admin status / confidence / metric colors.
 *
 * Everything here speaks the Nhẩm warm palette — sage `nham-success`,
 * terracotta `nham-danger`, brand `nham-accent`, with warm amber reserved for
 * "caution" tiers. The admin surfaces previously hand-rolled half a dozen
 * divergent `bg-green-100 / text-blue-600 / emerald / slate` maps; they all
 * funnel through the helpers below so a single edit recolors the section.
 */

const STATUS_TONE: Record<PipelineStatus, string> = {
  success: 'bg-nham-success/15 text-nham-success dark:bg-nham-success/20',
  error: 'bg-nham-danger/15 text-nham-danger dark:bg-nham-danger/20',
  pending:
    'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  skipped: 'bg-nham-hover text-nham-text-muted',
};

/** Badge background+text classes for a pipeline/stage status string. */
export function statusToneClass(status: string): string {
  return STATUS_TONE[status as PipelineStatus] ?? STATUS_TONE.skipped;
}

/** Solid dot color for a pipeline/stage status (timeline rails, list dots). */
export function statusDotClass(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-nham-success';
    case 'error':
      return 'bg-nham-danger';
    case 'pending':
      return 'bg-amber-500';
    default:
      return 'bg-nham-stone';
  }
}

export type Confidence = 'high' | 'medium' | 'low' | 'unmatched';

export interface ConfidenceTone {
  /** small solid dot (e.g. leading a match row) */
  dot: string;
  /** similarity-bar fill */
  bar: string;
  /** standalone text color */
  text: string;
  /** full badge (tinted background + readable text) */
  badge: string;
}

/**
 * Match-confidence tone. high → sage, medium → warm amber (good contrast +
 * clear "caution"), low / unmatched → terracotta.
 */
export function confidenceTone(c: Confidence): ConfidenceTone {
  switch (c) {
    case 'high':
      return {
        dot: 'bg-nham-success',
        bar: 'bg-nham-success',
        text: 'text-nham-success',
        badge: 'bg-nham-success/15 text-nham-success dark:bg-nham-success/20',
      };
    case 'medium':
      return {
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
        badge:
          'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
      };
    default:
      return {
        dot: 'bg-nham-danger',
        bar: 'bg-nham-danger',
        text: 'text-nham-danger',
        badge: 'bg-nham-danger/15 text-nham-danger dark:bg-nham-danger/20',
      };
  }
}

export type MetricTone = 'neutral' | 'good' | 'warn' | 'bad';

/** Text color for a summary metric (good/warn/bad rates, latencies). */
export function metricToneClass(tone: MetricTone): string {
  switch (tone) {
    case 'good':
      return 'text-nham-success';
    case 'warn':
      return 'text-amber-700 dark:text-amber-400';
    case 'bad':
      return 'text-nham-danger';
    default:
      return 'text-nham-text';
  }
}

export type CompareLabel = 'unchanged' | 'changed' | 'only-here';

/** Tone for the compare-diff labels in the stage timeline. */
export function compareLabelClass(label: CompareLabel): string {
  switch (label) {
    case 'changed':
      return 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300';
    case 'only-here':
      return 'bg-nham-accent/20 text-nham-text dark:bg-nham-accent/25';
    default:
      return 'bg-nham-hover text-nham-text-muted';
  }
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-medium font-sans-display text-xs capitalize',
        statusToneClass(status),
        className
      )}
    >
      {status}
    </span>
  );
}
