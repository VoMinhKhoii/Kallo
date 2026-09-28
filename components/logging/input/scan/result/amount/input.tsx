'use client';

import { useState } from 'react';

/**
 * A custom amount you can type: the number in ink, the unit muted beside it —
 * "250 ml". The field keeps its own text while typing and takes in OUTSIDE
 * changes (a − / + click, a cup) as they come; leaving it empty or at 0
 * restores the amount that will be logged, so what it shows is always what
 * Add meal sends.
 */
export function ScanAmountInput({
  amount,
  unit,
  label,
  disabled,
  onChange,
}: {
  amount: number;
  unit: string;
  label: string;
  disabled: boolean;
  onChange: (amount: number) => void;
}) {
  const [text, setText] = useState(String(amount));
  // An outside change (− / +, a cup) replaces the text; the user's own typing,
  // which already equals the amount, is left as typed.
  const [shown, setShown] = useState(amount);
  if (amount !== shown) {
    setShown(amount);
    if (Number.parseInt(text, 10) !== amount) setText(String(amount));
  }

  return (
    <label className="flex items-baseline justify-center gap-1">
      <input
        aria-label={label}
        inputMode="numeric"
        disabled={disabled}
        value={text}
        maxLength={6}
        size={Math.max(2, text.length)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '');
          setText(digits);
          const value = Number.parseInt(digits, 10);
          if (value > 0) onChange(value);
        }}
        onBlur={() => {
          if (!(Number.parseInt(text, 10) > 0)) setText(String(amount));
        }}
        className="bg-transparent text-right text-[16px] text-kallo-text tabular-nums outline-none"
      />
      <span className="text-[14px] text-kallo-text-muted">{unit}</span>
    </label>
  );
}
