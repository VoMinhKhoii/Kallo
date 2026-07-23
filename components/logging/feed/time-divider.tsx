import type { ReactNode } from 'react';

interface TimeDividerProps {
  timeLabel: string;
  children?: ReactNode;
}

export function TimeDivider({ timeLabel, children }: TimeDividerProps) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <div className="h-px flex-1 bg-nham-border/60" />
      <div className="flex items-center gap-2">
        <span className="font-bold font-sans-display text-[11px] text-nham-text-muted/60 tracking-widest">
          {timeLabel}
        </span>
        {children}
      </div>
      <div className="h-px flex-1 bg-nham-border/60" />
    </div>
  );
}
