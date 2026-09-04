'use client';

import { useTranslations } from 'next-intl';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/ui/cn';

interface DashboardSectionStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `error` gives the section its hedgehog and the shared error title;
   *  `loading` is the quiet placeholder a section shows while it waits. */
  variant?: 'loading' | 'error';
}

/** The canonical card chrome, so a section that failed still occupies the
 *  same box as the card it stands in for. */
const CARD =
  'h-full min-h-[180px] rounded-2xl border border-kallo-border/60 bg-card p-4 shadow-kallo-text/[0.03] shadow-sm';

export function DashboardSectionState({
  message,
  actionLabel,
  onAction,
  variant = 'loading',
}: DashboardSectionStateProps) {
  const t = useTranslations('dashboard');

  const action =
    actionLabel && onAction ? (
      <Button onClick={onAction} size="sm" variant="ink">
        {actionLabel}
      </Button>
    ) : null;

  if (variant === 'error') {
    return (
      <SurfaceState
        action={action}
        area="dashboard"
        className={CARD}
        compact
        kind="error"
        subtitle={message}
        title={t('sectionErrorTitle')}
      />
    );
  }

  return (
    <div
      className={cn(
        CARD,
        'flex flex-col items-center justify-center gap-3 text-center text-kallo-text-muted text-sm'
      )}
    >
      <p className="max-w-sm">{message}</p>
      {action}
    </div>
  );
}
