'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type AmountMode,
  GRAM_STEP,
  MAX_GRAMS,
  MAX_SERVINGS,
  QUICK_GRAM_OPTIONS,
} from '@/lib/domain/barcode/amount';

// Shared inner-element classes, matching the onboarding wizard's vocabulary.
const STEPPER_BTN =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EAE7E0] bg-white text-kallo-text transition-colors hover:bg-kallo-track disabled:opacity-40';
const NUMBER_INPUT =
  'h-10 min-w-0 flex-1 rounded-lg border border-[#EAE7E0] bg-white text-center font-semibold font-sans-display text-[15px] text-kallo-text tabular-nums focus:border-kallo-accent focus:outline-none focus:ring-1 focus:ring-kallo-accent/40';
const FIELD_LABEL =
  'block font-bold font-sans-display text-[13px] text-kallo-text';

interface BarcodeAmountControlsProps {
  /** The modes this product has sizing for; the segmented control is hidden
   *  when there is only one. */
  modes: AmountMode[];
  mode: AmountMode;
  onModeChange: (mode: AmountMode) => void;
  servings: number;
  onAdjustServings: (delta: number) => void;
  onSetServings: (value: number) => void;
  customGrams: number;
  onAdjustGrams: (delta: number) => void;
  onSetGrams: (value: number) => void;
  /** Total the current mode resolves to, shown alongside the stepper. */
  grams: number;
  servingSizeG: number | null;
}

/** How much of the scanned product was eaten: by serving, whole package, or
 *  custom grams. Amount state is owned by the product step above. */
export function BarcodeAmountControls({
  modes,
  mode,
  onModeChange,
  servings,
  onAdjustServings,
  onSetServings,
  customGrams,
  onAdjustGrams,
  onSetGrams,
  grams,
  servingSizeG,
}: BarcodeAmountControlsProps) {
  const t = useTranslations('logging');
  const modeLabel: Record<AmountMode, string> = {
    serving: t('barcodeAmountServing'),
    package: t('barcodeAmountPackage'),
    grams: t('barcodeAmountGrams'),
  };

  return (
    <>
      {/* Amount-mode segmented control (only when >1 mode is available) */}
      {modes.length > 1 ? (
        <div
          className="grid rounded-xl bg-kallo-track p-1"
          style={{
            gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))`,
          }}
          role="group"
          aria-label={t('barcodeAmountModeLabel')}
        >
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => onModeChange(m)}
              className={`rounded-lg px-3 py-2 font-medium font-sans-display text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/30 ${
                mode === m
                  ? 'bg-white text-kallo-text shadow-sm'
                  : 'text-[#8B8682] hover:text-kallo-text'
              }`}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'serving' && servingSizeG ? (
        <div className="space-y-2">
          <label htmlFor="servings-input" className={FIELD_LABEL}>
            {t('barcodeServingsLabel')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAdjustServings(-1)}
              disabled={servings <= 1}
              aria-label={t('barcodeDecreaseServings')}
              className={STEPPER_BTN}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              id="servings-input"
              type="number"
              min="1"
              max={MAX_SERVINGS}
              value={servings}
              onChange={(e) =>
                onSetServings(Number.parseInt(e.target.value, 10) || 1)
              }
              className={NUMBER_INPUT}
            />
            <button
              type="button"
              onClick={() => onAdjustServings(1)}
              disabled={servings >= MAX_SERVINGS}
              aria-label={t('barcodeIncreaseServings')}
              className={STEPPER_BTN}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <span className="block font-sans-display text-[#8B8682] text-[12px] tabular-nums">
            {t('barcodePerServing', { grams: servingSizeG })} ·{' '}
            {t('barcodeTotalGrams', { grams })}
          </span>
        </div>
      ) : null}

      {/* Package mode has nothing to adjust — its readout lives in the step. */}

      {mode === 'grams' ? (
        <div className="space-y-2">
          <label htmlFor="grams-input" className={FIELD_LABEL}>
            {t('barcodeGramsLabel')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAdjustGrams(-GRAM_STEP)}
              disabled={customGrams <= 1}
              aria-label={t('barcodeDecreaseGrams')}
              className={STEPPER_BTN}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              id="grams-input"
              type="number"
              min="1"
              max={MAX_GRAMS}
              value={customGrams}
              onChange={(e) =>
                onSetGrams(Number.parseInt(e.target.value, 10) || 0)
              }
              className={NUMBER_INPUT}
            />
            <button
              type="button"
              onClick={() => onAdjustGrams(GRAM_STEP)}
              disabled={customGrams >= MAX_GRAMS}
              aria-label={t('barcodeIncreaseGrams')}
              className={STEPPER_BTN}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {QUICK_GRAM_OPTIONS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onSetGrams(val)}
                className={`rounded-full border px-3 py-1 font-sans-display text-[13px] tabular-nums transition-colors ${
                  customGrams === val
                    ? 'border-kallo-border bg-kallo-hover font-semibold text-kallo-text'
                    : 'border-[#EAE7E0] bg-white text-[#8B8682] hover:bg-kallo-track'
                }`}
              >
                {val}g
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
