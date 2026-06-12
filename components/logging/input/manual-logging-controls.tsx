'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { useIngredientSearch } from '@/hooks/use-ingredient-search';
import {
  type IngredientSearchResult,
  type ManualMealRow,
  rowMacros,
  totalsForRows,
} from '@/lib/logging/manual-logging';
import { cn } from '@/lib/utils';

const EMPTY_RESULTS: IngredientSearchResult[] = [];

interface ManualLoggingControlsProps {
  disabled?: boolean;
  rows: ManualMealRow[];
  onRowChange: (id: string, patch: Partial<Omit<ManualMealRow, 'id'>>) => void;
  onRowAdd: (afterId?: string) => string;
  onRowRemove: (id: string) => void;
}

function formatKcal(value: number | null): string {
  if (value == null) return '—';
  return String(Math.round(value));
}

function formatMacro(value: number | null): string {
  if (value == null) return '—';
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function StateBadge({ state }: { state: string }) {
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
          ? 'bg-nham-accent/15 text-nham-accent'
          : 'bg-nham-hover/40 text-nham-text-muted'
      )}
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {label}
    </span>
  );
}

interface IngredientComboboxProps {
  rowId: string;
  value: IngredientSearchResult | null;
  disabled?: boolean;
  onSelect: (ingredient: IngredientSearchResult) => void;
  onClearSelection: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

function IngredientCombobox({
  rowId,
  value,
  disabled,
  onSelect,
  onClearSelection,
  inputRef,
}: IngredientComboboxProps) {
  const t = useTranslations('logging');
  const listboxId = useId();
  const [text, setText] = useState(value?.namePrimary ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const { data, isFetching } = useIngredientSearch(text, open);
  // Stable fallback identity — `data ?? []` inline would mint a new array
  // every render and re-trigger the render-adjustment below forever.
  const results = data ?? EMPTY_RESULTS;
  const isRecents = text.trim().length === 0;

  // Sync display text when the selection changes from outside (e.g. clear()),
  // adjusting state during render instead of in an effect.
  const valueName = value?.namePrimary ?? '';
  const [prevValueName, setPrevValueName] = useState(valueName);
  if (prevValueName !== valueName) {
    setPrevValueName(valueName);
    setText(valueName);
  }

  // Re-anchor the highlight when a new result set lands.
  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    setHighlighted(0);
  }

  const select = (ingredient: IngredientSearchResult) => {
    onSelect(ingredient);
    setText(ingredient.namePrimary);
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
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={t('manualLogging.searchPlaceholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHighlighted(0);
          setOpen(true);
          // Editing the text invalidates the previous pick.
          if (value) onClearSelection();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={t('manualLogging.searchPlaceholder')}
        disabled={disabled}
        className="w-full rounded-xl border border-nham-border/50 bg-nham-hover/10 px-3 py-2 text-nham-text text-sm transition-colors placeholder:text-nham-text-muted/40 focus:border-nham-accent/50 focus:outline-none disabled:opacity-50"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('manualLogging.searchPlaceholder')}
          className="absolute right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-nham-border/50 bg-background py-1 shadow-[0_8px_30px_color-mix(in_srgb,var(--color-nham-accent)_12%,transparent)]"
        >
          {isRecents && results.length > 0 && (
            <div
              aria-hidden
              className="px-3 pt-1.5 pb-1 text-[11px] text-nham-text-muted/60 uppercase tracking-wide"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('manualLogging.recentFoods')}
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
                'flex cursor-pointer items-center gap-2 px-3 py-2',
                idx === highlighted && 'bg-nham-hover/30'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="truncate text-nham-text text-sm"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {result.namePrimary}
                  </span>
                  <StateBadge state={result.state} />
                </div>
                {result.nameEn && (
                  <div
                    className="truncate text-nham-text-muted/70 text-xs"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {result.nameEn}
                  </div>
                )}
              </div>
              <span
                className="shrink-0 text-nham-text-muted text-xs tabular-nums"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {t('manualLogging.kcalPer100g', {
                  kcal: formatKcal(result.per100g.caloriesKcal),
                })}
              </span>
            </div>
          ))}
          {results.length === 0 && (
            <div
              className="px-3 py-2 text-nham-text-muted/70 text-sm"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
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

export function ManualLoggingControls({
  disabled,
  rows,
  onRowChange,
  onRowAdd,
  onRowRemove,
}: ManualLoggingControlsProps) {
  const t = useTranslations('logging');
  const searchRefs = useRef(new Map<string, HTMLInputElement | null>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    searchRefs.current.get(target)?.focus();
  });

  const totals = totalsForRows(rows);
  const hasTotals = totals.caloriesKcal != null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const macros = rowMacros(row);
          return (
            <div key={row.id} className="flex items-center gap-2">
              <IngredientCombobox
                rowId={row.id}
                value={row.ingredient}
                disabled={disabled}
                onSelect={(ingredient) => onRowChange(row.id, { ingredient })}
                onClearSelection={() =>
                  onRowChange(row.id, { ingredient: null })
                }
                inputRef={(el) => {
                  searchRefs.current.set(row.id, el);
                }}
              />
              <div className="relative w-[92px] shrink-0">
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.grams}
                  onChange={(e) =>
                    onRowChange(row.id, { grams: e.target.value })
                  }
                  placeholder={t('manualLogging.gramsPlaceholder')}
                  aria-label={t('manualLogging.gramsLabel')}
                  disabled={disabled}
                  className="w-full rounded-xl border border-nham-border/50 bg-nham-hover/10 py-2 pr-7 pl-3 text-nham-text text-sm tabular-nums transition-colors placeholder:text-nham-text-muted/40 focus:border-nham-accent/50 focus:outline-none disabled:opacity-50"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-nham-text-muted/50 text-xs"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {t('manualLogging.gramsUnit')}
                </span>
              </div>
              <span
                className="w-14 shrink-0 text-right text-nham-text-muted text-xs tabular-nums"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {macros
                  ? t('manualLogging.rowKcal', {
                      kcal: formatKcal(macros.caloriesKcal),
                    })
                  : ''}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRowRemove(row.id)}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-nham-text-muted/40 transition-colors',
                  'hover:bg-nham-hover/30 hover:text-nham-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40',
                  rows.length <= 1 && 'invisible'
                )}
                aria-label={t('manualLogging.removeItem')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            pendingFocus.current = onRowAdd(rows[rows.length - 1]?.id);
          }}
          className="flex items-center gap-1.5 px-1 py-1 text-nham-text-muted/60 text-sm transition-colors hover:text-nham-text-muted focus-visible:outline-none disabled:opacity-40"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('manualLogging.addItem')}
        </button>
      </div>

      {hasTotals && (
        <div className="flex items-baseline justify-between border-nham-border/30 border-t pt-2.5">
          <span
            className="text-nham-text-muted text-sm"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('manualLogging.total')}
          </span>
          <div
            className="flex items-baseline gap-3 tabular-nums"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <span className="font-medium text-nham-text text-sm">
              {t('manualLogging.totalKcal', {
                kcal: formatKcal(totals.caloriesKcal),
              })}
            </span>
            <span className="text-nham-text-muted text-xs">
              {t('manualLogging.totalMacros', {
                protein: formatMacro(totals.proteinG),
                carbs: formatMacro(totals.carbohydrateG),
                fat: formatMacro(totals.fatG),
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
