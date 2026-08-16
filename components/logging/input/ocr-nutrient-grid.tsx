'use client';

import { Flame } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface MacroItem {
  id: string;
  label: string;
  val: string;
  unit: string;
  icon: boolean;
  required?: boolean;
  hasError: boolean;
  errorText: string;
  setter: (val: string) => void;
}

export function OcrNutrientGrid({ items }: { items: MacroItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => {
        const errorId = `${item.id}-error`;
        return (
          <div
            key={item.id}
            className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3"
          >
            <label
              htmlFor={item.id}
              className="flex items-center gap-1.5 text-[#8B8682] text-[12px]"
            >
              {item.icon && <Flame className="h-3.5 w-3.5 text-nham-accent" />}
              <span>{item.label}</span>
            </label>
            <div className="flex items-baseline gap-1">
              <Input
                id={item.id}
                type="text"
                inputMode="decimal"
                aria-label={`${item.label} (${item.unit})`}
                aria-invalid={item.hasError}
                aria-describedby={item.hasError ? errorId : undefined}
                required={item.required}
                value={item.val}
                onChange={(event) => item.setter(event.target.value)}
                className="h-8 w-16 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
              />
              <span className="text-[#8B8682] text-[12px]">{item.unit}</span>
            </div>
            {item.hasError && (
              <p id={errorId} role="alert" className="text-nham-danger text-xs">
                {item.errorText}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
