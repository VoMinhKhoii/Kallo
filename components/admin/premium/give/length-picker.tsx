'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/core/ui/cn';

export type LengthValue =
  | { unit: 'days'; days: string }
  | { unit: 'until'; until: string };

const PRESETS = ['7', '14', '30', '90'];

/** Presets, any 1–365 days, or until a date. */
export function LengthPicker({
  value,
  onChange,
}: {
  value: LengthValue;
  onChange: (next: LengthValue) => void;
}) {
  const days = value.unit === 'days' ? value.days : '';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={days === preset}
            onClick={() => onChange({ unit: 'days', days: preset })}
            className={cn(
              'h-10 rounded-lg border px-3 text-sm hover:bg-kallo-hover',
              days === preset && 'bg-kallo-hover font-semibold'
            )}
          >
            {preset} days
          </button>
        ))}
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          aria-label="Number of days"
          className="w-24"
          value={days}
          onChange={(e) => onChange({ unit: 'days', days: e.target.value })}
        />
        <span className="text-muted-foreground text-sm">or until</span>
        <Input
          type="date"
          aria-label="Until date"
          className="w-44"
          value={value.unit === 'until' ? value.until : ''}
          onChange={(e) => onChange({ unit: 'until', until: e.target.value })}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        1–365 days, or a date within a year (Premium runs to the end of it,
        UTC).
      </p>
    </div>
  );
}
