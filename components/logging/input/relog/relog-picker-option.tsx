'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { formatKcal, formatMacro } from '@/lib/logging/manual-logging';
import type { RelogCandidate } from '@/lib/logging/relog/relog';
import { cn } from '@/lib/ui/cn';

interface RelogPickerOptionProps {
  candidate: RelogCandidate;
  id: string;
  isHighlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}

/** One row of the `/` picker. Dishes and meals share this layout — the subtitle
 *  is the macro split either way, so what you are about to log is visible
 *  before you commit to it. */
export function RelogPickerOption({
  candidate,
  id,
  isHighlighted,
  onHighlight,
  onSelect,
}: RelogPickerOptionProps) {
  const t = useTranslations('logging.relog');
  const ref = useRef<HTMLDivElement>(null);

  // Keep the highlighted row in view. The listbox never holds focus (the
  // textarea does, via aria-activedescendant), so the browser does no
  // scrolling of its own — arrowing past the fold would otherwise walk the
  // selection somewhere the user cannot see.
  useEffect(() => {
    if (isHighlighted) {
      // Optional-called: jsdom has no scrollIntoView, and this is presentation
      // only — never worth throwing a render over.
      ref.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isHighlighted]);

  return (
    // Keyboard is handled on the textarea that owns focus; this listbox is
    // never focused itself (aria-activedescendant pattern).
    <div
      ref={ref}
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
        isHighlighted && 'bg-kallo-hover/30'
      )}
    >
      <span className="min-w-0 flex-1 truncate font-sans-display text-kallo-text text-sm">
        {candidate.name}
      </span>
      <span className="shrink-0 font-sans-display text-kallo-text-muted/70 text-xs tabular-nums">
        {t('macroSplit', {
          protein: formatMacro(candidate.proteinG),
          carbs: formatMacro(candidate.carbohydrateG),
          fat: formatMacro(candidate.fatG),
        })}
      </span>
      <span className="shrink-0 font-sans-display text-kallo-text-muted text-xs tabular-nums">
        {t('optionKcal', { kcal: formatKcal(candidate.caloriesKcal) })}
      </span>
    </div>
  );
}
