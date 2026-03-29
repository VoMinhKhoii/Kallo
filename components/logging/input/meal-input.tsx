'use client';

import { ArrowUp } from 'lucide-react';

interface MealInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function MealInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: MealInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-nham-border/40 bg-white p-3 shadow-[0_4px_20px_rgba(201,168,124,0.06)] transition-all duration-300 focus-within:border-nham-accent/40 focus-within:shadow-[0_4px_20px_rgba(201,168,124,0.12)]">
      <label htmlFor="meal-input" className="sr-only">
        Describe your meal
      </label>
      <input
        id="meal-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your meal..."
        disabled={disabled}
        className="flex-1 bg-transparent font-normal text-nham-text text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nham-btn text-white transition-all duration-200 hover:bg-nham-btn-hover active:scale-95 disabled:opacity-30"
        aria-label="Submit meal"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}
