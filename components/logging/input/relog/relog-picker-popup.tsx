'use client';

import { useTranslations } from 'next-intl';
import { RelogPickerGroup } from '@/components/logging/input/relog/relog-picker-group';
import type { RelogCandidateList } from '@/hooks/meals/relog/use-relog-candidates';
import type { RelogCandidate } from '@/lib/logging/relog/relog';

interface RelogPickerPopupProps {
  listboxId: string;
  query: string;
  candidates: RelogCandidateList;
  highlighted: number;
  onHighlight: (index: number) => void;
  onSelect: (candidate: RelogCandidate) => void;
}

/**
 * The `/` picker: past dishes and past meals in two labelled groups.
 *
 * Opens UPWARD — the composer sits at the bottom of the feed — and is anchored
 * to the composer row rather than the caret, matching the ingredient combobox.
 * The listbox is never focused: the textarea keeps focus and owns the keyboard,
 * with `aria-activedescendant` pointing here.
 */
export function RelogPickerPopup({
  listboxId,
  query,
  candidates,
  highlighted,
  onHighlight,
  onSelect,
}: RelogPickerPopupProps) {
  const t = useTranslations('logging.relog');
  const { dishes, meals, options, isLoading, isFetching } = candidates;

  const isEmpty = options.length === 0;
  // Distinguish "you have no history yet" from "nothing matched that" — the
  // first is a state the user can't fix by retyping.
  const emptyMessage =
    isLoading || isFetching
      ? t('searching')
      : query
        ? t('noResults')
        : t('noHistory');

  return (
    <div
      id={listboxId}
      role="listbox"
      aria-label={t('pickerLabel')}
      className="absolute right-0 bottom-full left-0 z-20 mb-1 max-h-72 overflow-y-auto rounded-xl border border-nham-border/50 bg-white py-1 shadow-[0_8px_30px_color-mix(in_srgb,var(--color-nham-accent)_12%,transparent)]"
    >
      <span aria-live="polite" className="sr-only">
        {isEmpty ? emptyMessage : t('resultCount', { count: options.length })}
      </span>

      <RelogPickerGroup
        label={t('groupDishes')}
        candidates={dishes}
        offset={0}
        highlighted={highlighted}
        listboxId={listboxId}
        onHighlight={onHighlight}
        onSelect={onSelect}
      />
      <RelogPickerGroup
        label={t('groupMeals')}
        candidates={meals}
        offset={dishes.length}
        highlighted={highlighted}
        listboxId={listboxId}
        onHighlight={onHighlight}
        onSelect={onSelect}
      />

      {isEmpty && (
        <div className="px-3 py-2 font-sans-display text-nham-text-muted/70 text-sm">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
