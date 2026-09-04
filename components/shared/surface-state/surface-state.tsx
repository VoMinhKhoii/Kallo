'use client';

import type { ReactNode } from 'react';
import { SurfaceIllustration } from '@/components/shared/surface-state/surface-illustration';
import type { SurfaceArea, SurfaceKind } from '@/lib/brand/illustrations/cast';
import { cn } from '@/lib/core/ui/cn';

interface SurfaceStateProps {
  area: SurfaceArea;
  kind: SurfaceKind;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** In-card sizing: 64px art, 18px title, tighter padding. */
  compact?: boolean;
  as?: 'h1' | 'h2' | 'p';
  className?: string;
}

/**
 * The one shape every empty, error, 404 and offline surface takes:
 * illustration → title → subtitle → a single action, centred.
 *
 * Spacing runs on margins alone (never the flex gap, which would stack on top
 * of them): illustration → title 24 / 16 compact, title → subtitle 8,
 * subtitle → action 24 / 16.
 */
export function SurfaceState({
  area,
  kind,
  title,
  subtitle,
  action,
  compact = false,
  as = 'h2',
  className,
}: SurfaceStateProps) {
  const Tag = as;

  return (
    <section
      className={cn(
        'flex flex-col items-center justify-center gap-0 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className
      )}
      role={kind === 'error' ? 'alert' : undefined}
    >
      <div className={compact ? 'mb-4' : 'mb-6'}>
        <SurfaceIllustration area={area} compact={compact} kind={kind} />
      </div>
      <Tag
        className={cn(
          'text-balance font-normal font-serif text-kallo-text',
          compact
            ? 'text-[18px] leading-6 tracking-[-0.2px]'
            : 'text-[24px] leading-[30px] tracking-[-0.36px]'
        )}
      >
        {title}
      </Tag>
      {subtitle ? (
        <p
          className={cn(
            'mt-2 max-w-sm text-pretty font-sans-display text-kallo-text-muted leading-relaxed',
            compact ? 'text-[13px]' : 'text-[14px]'
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {action ? (
        <div className={compact ? 'mt-4' : 'mt-6'}>{action}</div>
      ) : null}
    </section>
  );
}
