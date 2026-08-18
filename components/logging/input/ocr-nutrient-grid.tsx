'use client';

import { Beef, Droplet, Flame, type LucideIcon, Wheat } from 'lucide-react';
import { Input } from '@/components/ui/input';

export interface MacroItem {
  id: string;
  key: string;
  label: string;
  val: string;
  unit: string;
  required?: boolean;
  hasError: boolean;
  errorText: string;
  setter: (val: string) => void;
}

/**
 * Icon + colour per macro, borrowed wholesale from the nutrition page's legend
 * so the three read the same wherever they appear together. These are the
 * charted `--nham-chart-*` trio, hue-split — not the quiet `--nham-macro-*`
 * set, which turns to mud when the three sit side by side.
 */
const MACRO_IDENTITY: Record<string, { Icon: LucideIcon; className: string }> =
  {
    calories: { Icon: Flame, className: 'text-nham-accent' },
    proteinGrams: { Icon: Beef, className: 'text-nham-chart-protein' },
    carbsGrams: { Icon: Wheat, className: 'text-nham-chart-carbs' },
    fatGrams: { Icon: Droplet, className: 'text-nham-chart-fat' },
  };

function NutrientField({ item }: { item: MacroItem }) {
  const errorId = `${item.id}-error`;
  const identity = MACRO_IDENTITY[item.key];
  return (
    <div className="space-y-1 rounded-xl border border-nham-border bg-white p-3">
      <label
        htmlFor={item.id}
        className="flex items-center gap-1.5 text-[12px] text-nham-text-muted"
      >
        {identity && (
          <identity.Icon className={`h-3.5 w-3.5 ${identity.className}`} />
        )}
        <span className="truncate">{item.label}</span>
        {/* The asterisk is what says "required" — there is no sentence under
            the button explaining it any more. */}
        {item.required && <span className="text-nham-danger">*</span>}
      </label>
      <div className="flex items-baseline gap-1">
        <Input
          id={item.id}
          type="text"
          inputMode="decimal"
          aria-label={`${item.label} (${item.unit})`}
          aria-invalid={item.hasError}
          aria-required={item.required}
          aria-describedby={item.hasError ? errorId : undefined}
          value={item.val}
          onChange={(event) => item.setter(event.target.value)}
          className="h-8 w-full min-w-0 border-none p-0 font-semibold text-[17px] text-nham-ink focus-visible:ring-0"
        />
        <span className="shrink-0 text-[12px] text-nham-text-muted">
          {item.unit}
        </span>
      </div>
      {item.hasError && (
        <p id={errorId} role="alert" className="text-nham-danger text-xs">
          {item.errorText}
        </p>
      )}
    </div>
  );
}

/**
 * The four required macros: calories on their own full-width row, then
 * protein / carbs / fat sharing one. Mirrors the Flutter grid exactly.
 */
export function OcrMacroGrid({ items }: { items: MacroItem[] }) {
  const calories = items.find((item) => item.key === 'calories');
  const rest = items.filter((item) => item.key !== 'calories');
  return (
    <div className="space-y-2.5">
      {calories && <NutrientField item={calories} />}
      <div className="grid grid-cols-3 gap-2">
        {rest.map((item) => (
          <NutrientField key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/** The optional micronutrients — two columns that collapse on a narrow phone. */
export function OcrNutrientGrid({ items }: { items: MacroItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
      {items.map((item) => (
        <NutrientField key={item.id} item={item} />
      ))}
    </div>
  );
}
