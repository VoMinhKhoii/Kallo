'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/ui/cn';

/**
 * One nutrient in the editor — the Flutter app's `ScanEditorField`: its name
 * (a macro keeps its coloured glyph), the value right-aligned, the unit muted.
 * Blank shows a grey "—" and saves as unknown; "0" is ink and saves as zero.
 */
export function ScanEditorField({
  label,
  unit,
  value,
  error,
  icon: Icon,
  iconColor,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  error: boolean;
  icon?: LucideIcon;
  iconColor?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-[52px] items-center gap-2 border-kallo-border not-first:border-t px-4">
      {Icon && (
        <Icon className="size-4 shrink-0" style={{ color: iconColor }} />
      )}
      <span className="flex-1 text-[16px] text-kallo-text">{label}</span>
      <input
        aria-label={label}
        aria-invalid={error || undefined}
        inputMode="decimal"
        value={value}
        placeholder="—"
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-24 bg-transparent text-right text-[16px] tabular-nums outline-none placeholder:text-kallo-text-muted',
          error ? 'text-kallo-danger' : 'text-kallo-text'
        )}
      />
      <span className="w-9 text-[14px] text-kallo-text-muted">{unit}</span>
    </label>
  );
}
