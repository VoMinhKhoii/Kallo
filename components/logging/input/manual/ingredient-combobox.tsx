'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import {
  ManualSubtitleLine,
  useStateWord,
} from '@/components/logging/input/manual/manual-food-row';
import { useIngredientSearch } from '@/hooks/meals/queries/use-ingredient-search';
import { cn } from '@/lib/core/ui/cn';
import { searchSubtitle } from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  type IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';

const EMPTY_RESULTS: IngredientSearchResult[] = [];

interface IngredientComboboxProps {
  rowId: string;
  /** The user's raw typed text — the source of truth for the input value. */
  query: string;
  ingredient: IngredientSearchResult | null;
  disabled?: boolean;
  autoFocus?: boolean;
  onQueryChange: (text: string) => void;
  onSelect: (ingredient: IngredientSearchResult) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

export function IngredientCombobox({
  rowId,
  query,
  ingredient,
  disabled,
  autoFocus,
  onQueryChange,
  onSelect,
  inputRef,
}: IngredientComboboxProps) {
  const t = useTranslations('logging');
  const stateWord = useStateWord();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const { data, isFetching } = useIngredientSearch(query, open);
  // Stable fallback identity — `data ?? []` inline would mint a new array
  // every render and re-trigger the render-adjustment below forever.
  const results = data ?? EMPTY_RESULTS;
  const isRecents = query.trim().length === 0;

  // Re-anchor the highlight when a new result set lands.
  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    setHighlighted(0);
  }

  const select = (result: IngredientSearchResult) => {
    onSelect(result);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[highlighted];
      if (result) select(result);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        // biome-ignore lint/a11y/noAutofocus: opening manual mode should raise the mobile keyboard
        autoFocus={autoFocus}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={t('manualLogging.searchPlaceholder')}
        value={query}
        onChange={(e) => {
          // Typing replaces the query and invalidates the previous pick.
          onQueryChange(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={t('manualLogging.searchPlaceholder')}
        disabled={disabled}
        className="w-full rounded-xl border border-kallo-border/50 bg-kallo-hover/10 px-3 py-2 font-sans-display text-kallo-text text-sm transition-colors placeholder:text-kallo-text-muted/40 focus:border-kallo-accent/50 focus:outline-none disabled:opacity-50"
      />
      {/* The picked DB entry's name — what's saved is the raw text above; this
          shows which composition entry supplies the nutrition. */}
      {ingredient && ingredient.namePrimary !== query.trim() && (
        <p className="mt-1 truncate px-1 font-sans-display text-kallo-text-muted text-xs">
          {ingredient.namePrimary}
          {ingredient.stateLabel && (
            <span className="text-kallo-text">
              {' · '}
              {stateWord(ingredient.stateLabel)}
            </span>
          )}
        </p>
      )}
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('manualLogging.searchPlaceholder')}
          // Opens UPWARD — the manual input sits at the bottom of the feed.
          className="absolute right-0 bottom-full left-0 z-20 mb-1 max-h-96 overflow-y-auto rounded-2xl border border-kallo-border/50 bg-card py-1 shadow-[0_8px_30px_color-mix(in_srgb,var(--color-kallo-accent)_12%,transparent)]"
        >
          {results.length > 0 && (
            <div
              aria-hidden
              className="flex items-baseline justify-between gap-3 px-4 pt-2 pb-1 font-sans-display text-[14px] text-kallo-text-muted"
            >
              <span className="truncate">
                {isRecents
                  ? t('manualLogging.recent')
                  : t('manualLogging.resultsFor', { query: query.trim() })}
              </span>
              <span className="shrink-0">{t('manualLogging.per100g')}</span>
            </div>
          )}
          {results.map((result, idx) => (
            <div
              key={result.id}
              id={`${listboxId}-${rowId}-${result.id}`}
              role="option"
              aria-selected={idx === highlighted}
              // mousedown fires before the input's blur, so the click still
              // lands while the dropdown is open.
              onMouseDown={(e) => {
                e.preventDefault();
                select(result);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              className={cn(
                'flex cursor-pointer items-center gap-5 px-4 py-2.5 font-sans-display',
                idx > 0 && 'border-kallo-border/60 border-t',
                idx === highlighted && 'bg-kallo-hover/40'
              )}
            >
              {/* The phone sheets' G2 row: the Vietnamese name, then the state
                  (only when the food's card names one) and English name. */}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[15px] text-kallo-text leading-[1.3]">
                  {result.namePrimary}
                </div>
                <ManualSubtitleLine
                  subtitle={searchSubtitle(result, stateWord)}
                />
              </div>
              <span className="shrink-0 whitespace-nowrap text-[15px] text-kallo-text tabular-nums">
                {formatKcal(result.per100g.caloriesKcal)}{' '}
                <span className="text-[13px] text-kallo-text-muted">kcal</span>
              </span>
            </div>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-2 font-sans-display text-kallo-text-muted/70 text-sm">
              {isFetching
                ? t('manualLogging.searching')
                : t('manualLogging.noResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
