'use client';

import { Input } from '@/components/ui/input';

/**
 * What the meal will be called once it is logged — seeded from the label, or
 * from a fallback when the scan couldn't read a product name.
 *
 * Split from `ocr-review-step.tsx` to keep that file under the 200-line
 * component limit.
 */
export function OcrProductNameField({
  value,
  isValid,
  label,
  errorText,
  onChange,
}: {
  value: string;
  isValid: boolean;
  label: string;
  errorText: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor="ocr-product-name"
        className="font-medium text-[12px] text-kallo-text-muted"
      >
        {label}
      </label>
      <Input
        id="ocr-product-name"
        type="text"
        value={value}
        aria-invalid={!isValid}
        aria-describedby={!isValid ? 'ocr-product-name-error' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border-kallo-border bg-white text-[14px] text-kallo-text focus-visible:border-kallo-accent"
      />
      {!isValid && (
        <p
          id="ocr-product-name-error"
          role="alert"
          className="text-kallo-danger text-xs"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
