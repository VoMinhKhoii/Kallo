'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

interface OptionStripItem {
  value: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

interface OptionStripProps {
  options: OptionStripItem[];
  value: string;
  onChange: (value: string) => void;
}

export function OptionStrip({ options, value, onChange }: OptionStripProps) {
  return (
    <div className="flex rounded-xl bg-kallo-track p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex flex-1 flex-col items-center rounded-lg py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40',
            value === opt.value
              ? 'bg-white text-kallo-text shadow-sm'
              : 'text-kallo-text-muted hover:text-kallo-text'
          )}
        >
          <span className="flex items-center gap-1.5 font-medium text-[13px]">
            {opt.icon && <opt.icon className="size-3.5" aria-hidden />}
            {opt.label}
          </span>
          {opt.hint && (
            <span className="mt-0.5 text-center text-[10px] leading-tight opacity-70">
              {opt.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
