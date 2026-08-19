'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';

/** Raw vs cooked marker on an ingredient — the two states the food table
 *  distinguishes, and the reason two rows can share a name. */
export function StateBadge({ state }: { state: string }) {
  const t = useTranslations('logging');
  const label =
    state === 'cooked'
      ? t('manualLogging.stateCooked')
      : t('manualLogging.stateRaw');
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-px text-[10px] uppercase tracking-wide',
        state === 'cooked'
          ? 'bg-kallo-hover text-kallo-text'
          : 'bg-kallo-hover/40 text-kallo-text-muted',
        'font-sans-display'
      )}
    >
      {label}
    </span>
  );
}
