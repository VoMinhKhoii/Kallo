'use client';

import { cn } from '@/lib/utils';

interface TimelineDateButtonProps {
  date: string;
  label: string;
  isActive: boolean;
  isToday?: boolean;
  hasMeal?: boolean;
  variant: 'desktop' | 'mobile';
  onSelectDate: (date: string) => void;
}

export function TimelineDateButton({
  date,
  label,
  isActive,
  isToday = false,
  hasMeal = false,
  variant,
  onSelectDate,
}: TimelineDateButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectDate(date)}
      aria-current={isActive ? 'date' : undefined}
      data-today={isToday ? 'true' : 'false'}
      data-has-meal={hasMeal ? 'true' : 'false'}
      className={cn(
        'group/date relative touch-manipulation rounded-xl font-medium font-sans-display tracking-tight transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface active:scale-[0.98]',
        variant === 'mobile'
          ? 'flex min-h-11 min-w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-2 text-[11px]'
          : 'flex min-h-9 min-w-0 flex-1 items-center px-2.5 py-1.5 text-sm',
        isActive
          ? 'bg-nham-btn text-white shadow-nham-btn/15 shadow-sm'
          : isToday
            ? 'bg-nham-accent/35 text-nham-text hover:bg-nham-accent/50'
            : 'text-nham-text-muted hover:bg-nham-hover/50 hover:text-nham-text'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {hasMeal && (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            isActive ? 'bg-white/80' : 'bg-nham-accent'
          )}
        />
      )}
    </button>
  );
}
