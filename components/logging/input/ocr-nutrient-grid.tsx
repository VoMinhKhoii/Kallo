'use client';

import { Beef, Droplet, Flame, type LucideIcon, Wheat } from 'lucide-react';

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

/**
 * A figure on a rule, not a boxed input. Hierarchy comes from the size of the
 * number — hero for calories, 17px for a macro — so the fields stop reading as
 * four identical form rows.
 */
function NutrientField({
  item,
  size,
}: {
  item: MacroItem;
  size: 'hero' | 'macro' | 'micro';
}) {
  const errorId = `${item.id}-error`;
  const identity = MACRO_IDENTITY[item.key];
  const inputSize =
    size === 'hero'
      ? 'text-[40px] leading-none tracking-[-1px]'
      : size === 'macro'
        ? 'text-[17px] leading-tight'
        : 'text-[14px] leading-tight';

  return (
    <div className="min-w-0">
      <label
        htmlFor={item.id}
        className="flex items-center gap-1.5 text-[12px] text-nham-text-muted"
      >
        {identity && (
          <identity.Icon
            className={`size-3.5 shrink-0 ${identity.className}`}
          />
        )}
        <span className="truncate">{item.label}</span>
        {item.required && <span className="text-nham-danger">*</span>}
      </label>
      <div className="mt-1 flex items-baseline gap-1.5">
        <input
          id={item.id}
          type="text"
          inputMode="decimal"
          placeholder={size === 'micro' ? '—' : '0'}
          aria-label={`${item.label} (${item.unit})`}
          aria-invalid={item.hasError}
          aria-required={item.required}
          aria-describedby={item.hasError ? errorId : undefined}
          value={item.val}
          onChange={(event) => item.setter(event.target.value)}
          className={`w-full min-w-0 border-none bg-transparent p-0 font-medium tabular-nums placeholder:text-nham-text-muted/40 focus:outline-none ${inputSize} ${
            item.hasError ? 'text-nham-danger' : 'text-nham-ink'
          }`}
        />
        <span className="shrink-0 text-[12px] text-nham-text-muted">
          {item.unit}
        </span>
      </div>
      {/* The rule carries the field's state, so the field needs no box. */}
      <div
        className={`mt-1 transition-colors ${
          item.hasError ? 'h-[1.5px] bg-nham-danger' : 'h-px bg-nham-border'
        }`}
      />
      {item.hasError && (
        <p id={errorId} role="alert" className="mt-1 text-nham-danger text-xs">
          {item.errorText}
        </p>
      )}
    </div>
  );
}

/**
 * The calorie figure the meal is worth, then protein / carbs / fat as three
 * equal columns under it. Mirrors the Flutter review step exactly.
 */
export function OcrMacroGrid({ items }: { items: MacroItem[] }) {
  const calories = items.find((item) => item.key === 'calories');
  const rest = items.filter((item) => item.key !== 'calories');
  return (
    <div className="space-y-5">
      {calories && <NutrientField item={calories} size="hero" />}
      <div className="grid grid-cols-3 gap-3">
        {rest.map((item) => (
          <NutrientField key={item.id} item={item} size="macro" />
        ))}
      </div>
    </div>
  );
}

/** The optional micronutrients — two columns that collapse on a narrow phone. */
export function OcrNutrientGrid({ items }: { items: MacroItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
      {items.map((item) => (
        <NutrientField key={item.id} item={item} size="micro" />
      ))}
    </div>
  );
}
