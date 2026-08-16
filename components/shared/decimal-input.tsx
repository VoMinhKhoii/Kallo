'use client';

import * as React from 'react';
import { parseDecimalInput } from '@/lib/text/parse-decimal';

type DecimalInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type'
> & {
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
  /** Restrict the reported value to a whole number (e.g. height, age). */
  integer?: boolean;
};

function valueToText(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value);
}

function textToValue(text: string, integer?: boolean): number | undefined {
  if (text.trim() === '') return undefined;
  const parsed = parseDecimalInput(text);
  if (integer && Number.isFinite(parsed)) return Math.trunc(parsed);
  return parsed;
}

/**
 * Controlled numeric input that keeps the user's raw text in the DOM while
 * reporting a parsed `number` upstream. Rendering the parsed number directly
 * (the usual `value={field.value}` pattern) erases an in-progress decimal
 * separator on every keystroke — typing "65," normalizes to 65 and the comma
 * vanishes — which makes decimals impossible to enter. Holding the raw string
 * locally avoids that and tolerates the comma separator iOS/EU keyboards emit.
 */
export const DecimalInput = React.forwardRef<
  HTMLInputElement,
  DecimalInputProps
>(function DecimalInput(
  { value, onValueChange, integer, onBlur, ...props },
  ref
) {
  const [text, setText] = React.useState(() => valueToText(value));
  const [syncedValue, setSyncedValue] = React.useState(value);

  // Sync external value changes (form reset, async profile load) into the
  // displayed text without clobbering an in-progress entry that already parses
  // to the same value. Adjusted during render per React's "storing prior prop"
  // pattern; Object.is treats NaN as equal to itself so garbage input can't loop.
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value);
    if (!Object.is(textToValue(text, integer), value)) {
      setText(valueToText(value));
    }
  }

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onValueChange(textToValue(raw, integer));
      }}
      onBlur={(e) => {
        // Collapse a valid entry to its canonical form once the user leaves
        // (e.g. "65," → "65", a decimal typed into an integer field → its
        // truncation). Invalid text is left untouched so the user can fix it.
        const parsed = textToValue(text, integer);
        if (parsed !== undefined && Number.isFinite(parsed)) {
          setText(valueToText(parsed));
        }
        onBlur?.(e);
      }}
    />
  );
});
