'use client';

import { useId } from 'react';
import { DecimalInput } from '@/components/shared/decimal-input';
import { cn } from '@/lib/core/ui/cn';
import { kgToLb, lbToKg } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';

/**
 * The calculators' inputs: a labelled number, a native select, and a row of
 * mutually exclusive choices. Native controls on purpose — they are the
 * accessible, phone-friendly ones, and a calculator needs nothing fancier.
 */

const labelClass =
  'mb-1.5 block font-sans-display text-kallo-text-muted text-sm';
const controlClass =
  'h-11 w-full rounded-lg border border-kallo-border bg-card px-3 text-base text-kallo-text transition-colors focus-visible:border-kallo-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/20';

export function NumberField({
  label,
  unit,
  value,
  onChange,
  integer = false,
  className,
}: {
  label: string;
  unit?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  integer?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label className={labelClass} htmlFor={id}>
        {label}
        {unit ? <span className="text-kallo-text-muted"> ({unit})</span> : null}
      </label>
      <DecimalInput
        className={controlClass}
        id={id}
        inputMode={integer ? 'numeric' : 'decimal'}
        integer={integer}
        onValueChange={onChange}
        value={value}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <select
        className={controlClass}
        id={id}
        onChange={(e) => onChange(e.target.value as T)}
        value={value}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className={labelClass}>{label}</legend>
      <div className="flex rounded-lg border border-kallo-border bg-card p-1">
        {options.map((o) => (
          <label
            className={cn(
              'flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-kallo-accent/40',
              o.value === value
                ? 'bg-kallo-ink font-medium text-kallo-surface'
                : 'text-kallo-text hover:bg-kallo-hover'
            )}
            key={o.value}
          >
            <input
              checked={o.value === value}
              className="sr-only"
              name={name}
              onChange={() => onChange(o.value)}
              type="radio"
              value={o.value}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The metric / imperial switch the English calculators show. */
export function UnitsField({
  ui,
  value,
  onChange,
}: {
  ui: ToolUi;
  value: 'metric' | 'imperial';
  onChange: (value: 'metric' | 'imperial') => void;
}) {
  return (
    <ChoiceField
      className="col-span-2"
      label={ui.units}
      onChange={onChange}
      options={[
        { value: 'metric', label: ui.metric },
        { value: 'imperial', label: ui.imperial },
      ]}
      value={value}
    />
  );
}

/**
 * A weight kept in kg whatever the view: typed and shown in lb (to 0.1) when
 * `imperial`, so a unit switch never rounds the stored value.
 */
export function WeightField({
  label,
  kg,
  onKg,
  imperial,
}: {
  label: string;
  kg: number | undefined;
  onKg: (kg: number | undefined) => void;
  imperial: boolean;
}) {
  return (
    <NumberField
      label={label}
      onChange={(w) => onKg(w === undefined || !imperial ? w : lbToKg(w))}
      unit={imperial ? 'lb' : 'kg'}
      value={
        kg === undefined || !imperial ? kg : Math.round(kgToLb(kg) * 10) / 10
      }
    />
  );
}
