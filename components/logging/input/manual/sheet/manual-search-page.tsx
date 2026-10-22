'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Ref } from 'react';
import {
  ManualFoodRow,
  useStateWord,
} from '@/components/logging/input/manual/manual-food-row';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { SheetCapsuleButton } from '@/components/shared/sheet-capsule-button';
import { useIngredientSearch } from '@/hooks/meals/queries/use-ingredient-search';
import {
  formatGrams,
  type ManualSheetItem,
  mealSubtitle,
  searchSubtitle,
} from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  type IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';

/**
 * The add sheet's first level (approved canvas, G2): the search pill, then
 * "Recent" before typing or "Results for “q”" after, "per 100 g" over the
 * calorie column, and one flat card of foods. A food already in the meal says
 * so in place and opens its page to change the amount, never to add it twice.
 */
export function ManualSearchPage({
  query,
  onQuery,
  autoFocus,
  inputRef,
  itemFor,
  onPick,
  onClose,
  showDone,
}: {
  query: string;
  onQuery: (query: string) => void;
  autoFocus: boolean;
  inputRef?: Ref<HTMLInputElement>;
  itemFor: (ingredientId: string) => ManualSheetItem | null;
  onPick: (food: IngredientSearchResult) => void;
  onClose: () => void;
  showDone: boolean;
}) {
  const t = useTranslations('logging.manualLogging');
  const stateWord = useStateWord();
  const { data, isFetching, isError } = useIngredientSearch(query, true);
  const trimmed = query.trim();
  const results = data ?? [];

  const message = (text: string) => (
    <p className="py-6 text-center text-[14px] text-kallo-text-muted">{text}</p>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResponsiveSheetHeader
        title={t('sheetTitle')}
        closeLabel={t('close')}
        onClose={onClose}
        trailing={
          showDone ? (
            <SheetCapsuleButton label={t('done')} onClick={onClose} />
          ) : undefined
        }
      />
      <div className="px-4">
        <label className="flex h-[52px] items-center gap-2.5 rounded-full bg-card px-[18px]">
          <Search aria-hidden className="size-[18px] text-kallo-text-muted" />
          <input
            ref={inputRef}
            type="search"
            spellCheck={false}
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: opening the add sheet is a request to search
            autoFocus={autoFocus}
            aria-label={t('sheetSearchPlaceholder')}
            placeholder={t('sheetSearchPlaceholder')}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[16px] text-kallo-text outline-none placeholder:text-kallo-text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => onQuery('')}
              className="flex size-8 items-center justify-center text-kallo-text-muted"
            >
              <X className="size-[18px]" />
            </button>
          )}
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mx-1 mt-4 mb-2 flex items-baseline justify-between gap-3 text-[14px] text-kallo-text-muted">
          <span className="truncate">
            {trimmed ? t('resultsFor', { query: trimmed }) : t('recent')}
          </span>
          <span className="shrink-0">{t('per100g')}</span>
        </div>
        {isError ? (
          message(t('searchError'))
        ) : results.length === 0 ? (
          message(
            isFetching
              ? t('searching')
              : trimmed
                ? t('noResults')
                : t('recentsHint')
          )
        ) : (
          <div className="rounded-[22px] bg-card px-4">
            {results.map((food, index) => {
              const item = itemFor(food.id);
              const inMeal = item
                ? t('inMeal', { grams: formatGrams(item.grams) })
                : null;
              return (
                <div
                  key={food.id}
                  className={index > 0 ? 'border-kallo-border border-t' : ''}
                >
                  <ManualFoodRow
                    name={food.namePrimary}
                    subtitle={
                      inMeal
                        ? mealSubtitle(food, stateWord, inMeal)
                        : searchSubtitle(food, stateWord)
                    }
                    kcal={formatKcal(food.per100g.caloriesKcal)}
                    added={item !== null}
                    addedLabel={t('added')}
                    label={[food.namePrimary, inMeal]
                      .filter(Boolean)
                      .join(', ')}
                    onClick={() => onPick(food)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
