'use client';

import { Cookie } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';

interface CheatOccasionChipsProps {
  occasions: RecentCheatOccasion[];
  disabled?: boolean;
  /** Re-open a past occasion's sliders (seeded with last time's amounts). */
  onSelect: (occasion: RecentCheatOccasion) => void;
}

export function CheatOccasionChips({
  occasions,
  disabled,
  onSelect,
}: CheatOccasionChipsProps) {
  const t = useTranslations('logging.cheatRepeat');

  if (occasions.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto mb-2 flex max-w-3xl flex-col gap-1.5">
      <span className="px-1 font-bold font-sans-display text-[10px] text-kallo-text-muted/60 uppercase tracking-widest">
        {t('title')}
      </span>
      <div className="flex flex-wrap gap-2">
        {occasions.map((occasion) => (
          <button
            key={occasion.mealId}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(occasion)}
            title={occasion.rawInput}
            className="flex max-w-[14rem] items-center gap-1.5 rounded-full border border-kallo-border/60 px-3 py-1.5 font-sans-display text-kallo-text text-xs transition-colors hover:border-kallo-accent/60 hover:bg-kallo-hover/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Cookie className="h-3 w-3 shrink-0 text-kallo-text-muted" />
            <span className="truncate">{occasion.rawInput}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
