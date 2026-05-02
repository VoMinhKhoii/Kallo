'use client';

import { Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useTransition } from 'react';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { cn } from '@/lib/utils';

/**
 * Warm, on-brand onboarding-incomplete nudge.
 *
 * Two visual states:
 * - **Full** — gradient surface that lives in the wood/cream palette
 *   (`from-nham-accent/10 via-nham-surface to-nham-hover/55`). Shows step
 *   counter, copy, progress bar, and primary CTA.
 * - **Minimized pill** — a compact, low-dominance row (sparkles icon +
 *   short "Resume setup" label). Triggered by the small × button on the
 *   full state. Persists per-user in the database (not localStorage), so
 *   the choice syncs cross-device and the first paint is correct (the
 *   server already knows whether to render the pill or the card).
 *   Clicking the pill itself opens the onboarding flow again.
 *
 * Variants:
 * - `default` — desktop sidebar card (full).
 * - `mobile` — top of the bottom-sheet, slightly tighter.
 */
export function OnboardingNudge({
  step,
  onResume,
  isMinimized,
  onMinimize,
  onRestore,
  variant = 'default',
  className,
}: {
  step: number;
  onResume: () => void;
  /** Server-truth: is the nudge currently minimized? */
  isMinimized: boolean;
  /** Server action: persist the minimized choice. */
  onMinimize: () => Promise<void> | void;
  /** Server action: clear the minimized choice (called when resuming). */
  onRestore: () => Promise<void> | void;
  variant?: 'default' | 'mobile';
  className?: string;
}) {
  const t = useTranslations('app.onboardingNudge');
  const [, startTransition] = useTransition();

  const total = ONBOARDING_TOTAL_STEPS;
  const safeStep = Math.max(0, Math.min(step, total));
  const completedSteps = Math.min(safeStep, total);
  const progressPct = (completedSteps / total) * 100;
  const currentStepLabel = Math.min(safeStep + 1, total);

  // Optimistic minimize: collapse to pill immediately, persist in the
  // background. The server is the source of truth on next paint, but the
  // local transition makes the click feel instant.
  const handleMinimize = () => {
    startTransition(() => {
      void Promise.resolve(onMinimize());
    });
  };

  // Resume-from-pill: clear the server flag AND open the wizard. We don't
  // await — the wizard opens optimistically, the persist runs in parallel.
  const handleResumeFromPill = () => {
    startTransition(() => {
      void Promise.resolve(onRestore());
    });
    onResume();
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={handleResumeFromPill}
        aria-label={t('restoreLabel', {
          current: currentStepLabel,
          total,
        })}
        className={cn(
          'group flex w-full items-center gap-2 rounded-lg border border-nham-accent/20 bg-nham-accent/[0.06] px-2.5 py-2 text-left transition-colors hover:bg-nham-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface',
          className
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-nham-accent/15 text-nham-accent"
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium font-sans-display text-[11px] text-nham-text leading-tight">
            {t('minimizedTitle')}
          </span>
          <span className="block font-sans-display text-[10px] text-nham-text-muted leading-tight">
            {t('stepCounter', { current: currentStepLabel, total })}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label={t('regionLabel')}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br from-nham-accent/10 via-nham-surface to-nham-hover/55 ring-1 ring-nham-accent/25 ring-inset transition-shadow hover:ring-nham-accent/35',
        variant === 'default' ? 'p-3.5' : 'p-4',
        className
      )}
    >
      <button
        type="button"
        onClick={handleMinimize}
        aria-label={t('minimize')}
        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-nham-text-muted/70 opacity-0 transition-all duration-200 hover:bg-nham-hover/70 hover:text-nham-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="mb-2 flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md bg-nham-accent/20 text-nham-accent"
          aria-hidden="true"
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.06em]">
          {t('stepCounter', { current: currentStepLabel, total })}
        </span>
      </div>

      <p className="mb-1 font-medium font-sans-display text-[12px] text-nham-text leading-snug">
        {t('title')}
      </p>
      <p className="mb-3 font-sans-display text-[11px] text-nham-text-muted leading-relaxed">
        {t('description')}
      </p>

      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-nham-border/40"
        role="progressbar"
        aria-valuenow={completedSteps}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('progressLabel')}
      >
        <div
          className="h-full rounded-full bg-nham-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={onResume}
        className="w-full rounded-lg bg-nham-btn px-3 py-2 font-medium font-sans-display text-[11px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        {t('cta')}
      </button>
    </div>
  );
}

/**
 * Compact dot indicator placed on the avatar in the collapsed sidebar (or on
 * the avatar tab in mobile). Pulses gently to indicate an unfinished state.
 */
export function OnboardingDot({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute h-2 w-2 animate-pulse-dot rounded-full bg-nham-accent ring-2 ring-nham-surface',
        className
      )}
      {...rest}
    />
  );
}
