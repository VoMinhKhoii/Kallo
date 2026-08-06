'use client';

import { Flame } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface MacroItem {
  label: string;
  val: number;
  unit: string;
  icon: boolean;
  step: string;
  setter: (val: number) => void;
}

export function OcrNutrientGrid({ items }: { items: MacroItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3"
        >
          <div className="flex items-center gap-1.5 text-[#8B8682] text-[12px]">
            {item.icon && <Flame className="h-3.5 w-3.5 text-nham-accent" />}
            <span>{item.label}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <Input
              type="number"
              step={item.step}
              value={item.val}
              onChange={(e) => item.setter(Number(e.target.value))}
              className="h-8 w-16 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
            />
            <span className="text-[#8B8682] text-[12px]">{item.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
