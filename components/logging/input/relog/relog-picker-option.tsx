'use client';

import { useTranslations } from 'next-intl';
import { formatKcal } from '@/lib/logging/manual-logging';
import type { RelogCandidate } from '@/lib/logging/relog/relog';
import { cn } from '@/lib/utils';

interface RelogPickerOptionProps {
  candidate: RelogCandidate;
  id: string;
  isHighlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}

/** One row of the `/` picker. Dishes and meals differ only in their subtitle —
 *  ingredient count vs dish count — so they share this row rather than
 *  duplicating the layout twice. */
export function RelogPickerOption({
  candidate,
  id,
  isHighlighted,
  onHighlight,
  onSelect,
}: RelogPickerOptionProps) {
  const t = useTranslations('logging.relog');

  const subtitle =
    candidate.kind === 'dish'
      ? t('ingredientCount', { count: candidate.ingredientCount })
      : t('dishCount', { count: candidate.dishCount });

  return (
    // Keyboard is handled on the textarea that owns focus; this listbox is
    // never focused itself (aria-activedescendant pattern).
    <div
      id={id}
      role="option"
      aria-selected={isHighlighted}
      // mousedown fires before the textarea's blur, so the click still lands
      // while the popup is open.
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHighlight}
      className={cn(
        'flex cursor-pointer items-center gap-2 px-3 py-2',
        isHighlighted && 'bg-nham-hover/30'
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate font-sans-display text-nham-text text-sm">
          {candidate.name}
        </span>
        <span className="block truncate font-sans-display text-nham-text-muted/70 text-xs">
          {subtitle}
        </span>
      </div>
      <span className="shrink-0 font-sans-display text-nham-text-muted text-xs tabular-nums">
        {t('optionKcal', { kcal: formatKcal(candidate.caloriesKcal) })}
      </span>
    </div>
  );
}
