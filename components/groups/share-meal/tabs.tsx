'use client';

import { cn } from '@/lib/core/ui/cn';

/**
 * Whole portion versus split.
 *
 * "Nguyên phần" replaced the shipped "Cùng một món": both tabs now turn on the
 * same noun and differ by one word, whole versus divided, which is the only
 * thing that actually changes between them.
 */
export function ShareMealTabs({
  mode,
  wholeLabel,
  splitLabel,
  onChange,
}: {
  mode: 'whole' | 'split';
  wholeLabel: string;
  splitLabel: string;
  onChange: (mode: 'whole' | 'split') => void;
}) {
  return (
    <div className="mt-3.5 flex h-9 rounded-xl bg-kallo-hover/70 p-[3px]">
      {(['whole', 'split'] as const).map((m) => (
        <button
          aria-pressed={mode === m}
          className={cn(
            'flex-1 rounded-[9px] font-sans-display text-[13px] transition-colors',
            mode === m
              ? 'bg-white text-kallo-text shadow-sm'
              : 'text-kallo-text-muted'
          )}
          key={m}
          onClick={() => onChange(m)}
          type="button"
        >
          {m === 'whole' ? wholeLabel : splitLabel}
        </button>
      ))}
    </div>
  );
}
