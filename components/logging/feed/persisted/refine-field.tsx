'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { MEAL_TEXT_MAX_LENGTH } from '@/lib/core/validation/meal';

// The NL-refine is submitted as `${rawInput} (${correction})` — the joining

const REFINE_JOIN_CHARS = 3;
// Below this remaining budget we still allow a short correction (the feed
// truncates the original text to fit) but tell the user about the trade.
const REFINE_MIN_BUDGET = 20;

export function RefineField({
  meal,
  onRefine,
  autoFocus = false,
}: {
  meal: PersistedMeal;
  onRefine: (correction: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations('logging.persistedMealCard');
  const [correction, setCorrection] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount only when explicitly opened by the user (the "Fix with
  // words" action) — never steal focus when the field renders passively.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submitRefine = () => {
    const trimmed = correction.trim();
    if (trimmed.length === 0) return;
    onRefine(trimmed);
  };

  // Keep `rawInput + correction + join` within the server's message cap. When
  // the original text leaves almost no room, allow a short correction anyway —
  // the feed truncates the original to fit — and surface that quietly.
  const refineBudget =
    MEAL_TEXT_MAX_LENGTH - REFINE_JOIN_CHARS - meal.rawInput.length;
  const refineTight = refineBudget < REFINE_MIN_BUDGET;
  const refineMaxLength = Math.max(
    Math.min(200, refineBudget),
    REFINE_MIN_BUDGET
  );

  return (
    <>
      <label
        htmlFor={`refine-${meal.id}`}
        className="px-1 font-medium font-sans-display text-[10px] text-kallo-text-muted uppercase tracking-[0.08em]"
      >
        {t('refineLabel')}
      </label>
      <div className="mt-1.5 flex items-stretch gap-2">
        <input
          ref={inputRef}
          id={`refine-${meal.id}`}
          value={correction}
          onChange={(event) => setCorrection(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitRefine();
            }
          }}
          placeholder={t('refinePlaceholder')}
          autoComplete="off"
          maxLength={refineMaxLength}
          className="min-w-0 flex-1 rounded-lg border border-kallo-border/60 bg-white px-3 py-2 font-sans-display text-[13px] text-kallo-text placeholder:text-kallo-text-muted/50 focus:border-kallo-accent/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitRefine}
          disabled={correction.trim().length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-kallo-hover px-3 font-medium font-sans-display text-[12px] text-kallo-text transition-colors hover:bg-kallo-hover/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('refineSubmit')}
        </button>
      </div>
      <p className="mt-1.5 px-1 font-sans-display text-[11px] text-kallo-text-muted/70">
        {refineTight ? t('refineTightHint') : t('refineHint')}
      </p>
    </>
  );
}
