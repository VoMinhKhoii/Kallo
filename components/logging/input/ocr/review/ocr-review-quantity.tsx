'use client';

import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface OcrReviewQuantityProps {
  amountText: string;
  unit: string;
  amountIsValid: boolean;
  servingAmount: number | null;
  packageAmount: number | null;
  amountLabel: string;
  invalidText: string;
  servingText: string;
  packageText: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: string) => void;
  onCommit: (value?: string) => void;
}

export function OcrReviewQuantity(props: OcrReviewQuantityProps) {
  const parsedAmount = Number(props.amountText.replace(',', '.'));
  const stepAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const decreasedAmount = stepAmount - 1;
  return (
    <fieldset className="space-y-3 rounded-xl border border-kallo-border bg-kallo-track/30 p-3.5">
      <legend className="px-1 font-medium text-[12px] text-kallo-text">
        {props.amountLabel}
      </legend>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={props.decreaseLabel}
          onClick={() =>
            props.onCommit(
              decreasedAmount > 0 ? String(decreasedAmount) : props.amountText
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-kallo-border bg-white hover:bg-kallo-track"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            id="ocr-amount"
            type="text"
            inputMode="decimal"
            value={props.amountText}
            aria-invalid={!props.amountIsValid}
            aria-describedby={
              !props.amountIsValid ? 'ocr-amount-error' : undefined
            }
            onChange={(event) => props.onChange(event.target.value)}
            onBlur={() => props.onCommit()}
            className="h-9 text-center font-bold text-kallo-ink"
          />
          <label
            htmlFor="ocr-amount"
            className="shrink-0 text-kallo-text-muted text-sm"
          >
            {props.unit}
          </label>
        </div>
        <button
          type="button"
          aria-label={props.increaseLabel}
          onClick={() => props.onCommit(String(stepAmount + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-kallo-border bg-white hover:bg-kallo-track"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {!props.amountIsValid && (
        <p
          id="ocr-amount-error"
          role="alert"
          className="text-kallo-danger text-xs"
        >
          {props.invalidText}
        </p>
      )}
      {(props.servingAmount !== null || props.packageAmount !== null) && (
        <div className="flex flex-wrap gap-2">
          {props.servingAmount !== null && (
            <button
              type="button"
              onClick={() => props.onCommit(String(props.servingAmount))}
              className="rounded-full border border-kallo-border bg-white px-3 py-1.5 text-kallo-text-muted text-xs hover:text-kallo-text"
            >
              {props.servingText}
            </button>
          )}
          {props.packageAmount !== null && (
            <button
              type="button"
              onClick={() => props.onCommit(String(props.packageAmount))}
              className="rounded-full border border-kallo-border bg-white px-3 py-1.5 text-kallo-text-muted text-xs hover:text-kallo-text"
            >
              {props.packageText}
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}
