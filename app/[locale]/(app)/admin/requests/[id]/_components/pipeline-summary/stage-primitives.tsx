import { cn } from '@/lib/utils';
import type { DiagnosticStageStatus, StageLog } from './types';

// ---------------------------------------------------------------------------
// Lenient schemas — the pipeline writes typed JSON, but we never want this
// component to crash if a stage's output drifts. On parse failure we fall
// through to a small notice and the StageTimeline below still renders raw.
// ---------------------------------------------------------------------------

export function findStage(
  stages: StageLog[],
  name: string
): StageLog | undefined {
  return stages.find((s) => s.stage === name);
}

export function normalizeStageStatus(
  status: string | undefined
): DiagnosticStageStatus {
  if (status === 'success' || status === 'error' || status === 'skipped') {
    return status;
  }
  return 'pending';
}

export function pickConfidenceTone(c: 'high' | 'medium' | 'low'): {
  dot: string;
  bar: string;
  text: string;
  badgeBg: string;
} {
  if (c === 'high')
    return {
      dot: 'bg-green-500',
      bar: 'bg-green-500',
      text: 'text-green-700 dark:text-green-400',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
    };
  if (c === 'medium')
    return {
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    };
  return {
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
  };
}

export function StageDot({ status }: { status: DiagnosticStageStatus }) {
  if (status === 'success') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-green-500 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  if (status === 'error') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  if (status === 'skipped') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-muted-foreground/40 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-muted-foreground/30 ring-4 ring-background"
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------

export function StageRow({
  dot,
  status,
  title,
  meta,
  children,
}: {
  dot: React.ReactNode;
  status: DiagnosticStageStatus;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <div className="flex w-8 shrink-0 justify-center pt-1">{dot}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground capitalize">
              {status}
            </span>
          </div>
          {meta}
        </div>
        {children}
      </div>
    </li>
  );
}

export function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-700 dark:text-red-400'
          : '';
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className={cn('font-medium text-sm tabular-nums', toneClass)}>
        {value}
      </span>
    </div>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
      {children}
    </span>
  );
}

export function ParseFallback({ stage }: { stage: string }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-muted-foreground text-xs">
      Could not parse <code className="font-mono">{stage}</code> output. See raw
      stage below.
    </p>
  );
}
