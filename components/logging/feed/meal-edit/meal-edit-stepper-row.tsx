'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';

interface MealEditStepperRowProps {
  label: string;
  value: string;
  /** What a screen reader says for each button. */
  minusLabel: string;
  plusLabel: string;
  /** Undefined disables the button. */
  onMinus?: () => void;
  onPlus?: () => void;
  /** The minus would take the dish out rather than shrink it: show a trash. */
  minusRemoves?: boolean;
}

const BUTTON =
  'flex h-7 w-7 items-center justify-center rounded-md border border-kallo-border bg-card text-kallo-text transition-colors hover:bg-kallo-hover disabled:pointer-events-none disabled:opacity-40';

/** One row of the meal edit dialog: a label, then `−  value  +`. */
export function MealEditStepperRow({
  label,
  value,
  minusLabel,
  plusLabel,
  onMinus,
  onPlus,
  minusRemoves = false,
}: MealEditStepperRowProps) {
  const MinusIcon = minusRemoves ? Trash2 : Minus;
  return (
    <div className="flex min-h-[46px] items-center gap-2.5 font-sans-display text-kallo-text text-sm">
      <span className="flex-1">{label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={minusLabel}
          disabled={!onMinus}
          onClick={onMinus}
          className={BUTTON}
        >
          <MinusIcon className="h-3 w-3" />
        </button>
        <span className="min-w-[76px] whitespace-nowrap text-center tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label={plusLabel}
          disabled={!onPlus}
          onClick={onPlus}
          className={BUTTON}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
