'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/ui/cn';

interface OptionStripItem {
  value: string;
  label: string;
  /** A second, smaller line under the label (e.g. a split's numbers). */
  description?: string;
  icon?: LucideIcon;
}

interface OptionStripProps {
  options: OptionStripItem[];
  value: string;
  onChange: (value: string) => void;
}

export function OptionStrip({ options, value, onChange }: OptionStripProps) {
  return (
    <div className="flex rounded-lg bg-kallo-track p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex min-h-8 min-w-0 flex-1 flex-col items-center justify-center rounded-md px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40',
            value === opt.value
              ? 'bg-kallo-thumb text-kallo-text shadow-sm'
              : 'text-kallo-text-muted hover:text-kallo-text'
          )}
        >
          <span className="flex items-center gap-1.5 font-medium text-[13px]">
            {opt.icon && <opt.icon className="size-3.5" aria-hidden />}
            {opt.label}
          </span>
          {opt.description && (
            <span className="text-[12px] tabular-nums opacity-70">
              {opt.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
