'use client';

import { ArrowLeft, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { MAX_FOOD_ITEM_GRAMS } from '@/lib/barcode/constants';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';

const GRAM_STEP = 50;
// Shared cap so a large-but-valid package (OFF allows up to 100kg) is never
// silently clipped when resolved in serving/package mode.
const MAX_GRAMS = MAX_FOOD_ITEM_GRAMS;
const MAX_SERVINGS = 99;
const QUICK_GRAM_OPTIONS = [50, 100, 150, 200, 250];

type AmountMode = 'serving' | 'package' | 'grams';

const clampGrams = (g: number) => Math.min(MAX_GRAMS, Math.max(1, g));

// Shared inner-element classes, matching the onboarding wizard's vocabulary.
const STEPPER_BTN =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EAE7E0] bg-white text-[#2C2416] transition-colors hover:bg-[#F5F4F0] disabled:opacity-40';
const NUMBER_INPUT =
  'h-10 min-w-0 flex-1 rounded-lg border border-[#EAE7E0] bg-white text-center font-semibold font-sans-display text-[15px] text-[#2C2416] tabular-nums focus:border-[#C9A87C] focus:outline-none focus:ring-1 focus:ring-[#C9A87C]/40';
const FIELD_LABEL =
  'block font-bold font-sans-display text-[13px] text-[#2C2416]';

/** Scale a per-100g nutrient to `grams`. Calories round to whole numbers,
 *  macros to one decimal, matching the source data's precision. */
function scaleValue(
  per100: number | null,
  grams: number,
  decimals: number
): number | null {
  if (per100 === null) return null;
  const value = (per100 * grams) / 100;
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
}

interface BarcodeProductStepProps {
  product: ParsedBarcodeProduct;
  isStaging: boolean;
  onBack: () => void;
  /** Called with the resolved gram amount to stage. */
  onConfirm: (grams: number) => void;
}

/** The "quantity" step of the barcode dialog. Lets the user pick an amount by
 *  serving, whole package, or custom grams — offering only the modes the
 *  product actually has sizing for — and previews the nutrition for the chosen
 *  amount before staging. Owns all amount state; remounted per product (keyed
 *  on barcode by the dialog) so the defaults re-initialize on each scan.
 *  Renders as a scrollable content region + pinned footer, mirroring the
 *  onboarding wizard's shell. */
export function BarcodeProductStep({
  product,
  isStaging,
  onBack,
  onConfirm,
}: BarcodeProductStepProps) {
  const t = useTranslations('logging');
  const { servingSizeG, packageSizeG } = product;

  // Available modes, in priority order. Grams is always offered as a fallback.
  const modes = useMemo<AmountMode[]>(() => {
    const list: AmountMode[] = [];
    if (servingSizeG) list.push('serving');
    if (packageSizeG) list.push('package');
    list.push('grams');
    return list;
  }, [servingSizeG, packageSizeG]);

  const [mode, setMode] = useState<AmountMode>(modes[0]);
  const [servings, setServings] = useState(1);
  const [customGrams, setCustomGrams] = useState(
    clampGrams(Math.round(servingSizeG ?? packageSizeG ?? 100))
  );

  const grams =
    mode === 'serving' && servingSizeG
      ? clampGrams(Math.round(servings * servingSizeG))
      : mode === 'package' && packageSizeG
        ? clampGrams(Math.round(packageSizeG))
        : clampGrams(customGrams);

  const adjustServings = (delta: number) =>
    setServings((s) => Math.min(MAX_SERVINGS, Math.max(1, s + delta)));
  const adjustGrams = (delta: number) =>
    setCustomGrams((g) => clampGrams(g + delta));

  const modeLabel: Record<AmountMode, string> = {
    serving: t('barcodeAmountServing'),
    package: t('barcodeAmountPackage'),
    grams: t('barcodeAmountGrams'),
  };

  const calories = scaleValue(product.caloriesKcal, grams, 0);
  const macros = [
    {
      label: t('barcodeProtein'),
      value: scaleValue(product.proteinG, grams, 1),
    },
    {
      label: t('barcodeCarbs'),
      value: scaleValue(product.carbohydrateG, grams, 1),
    },
    { label: t('barcodeFat'), value: scaleValue(product.fatG, grams, 1) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Product header */}
        <div>
          {product.brand ? (
            <span className="font-medium font-sans-display text-[#8B8682] text-[11px] uppercase tracking-[0.12em]">
              {product.brand}
            </span>
          ) : null}
          <h3 className="font-normal font-serif text-[#2C2416] text-[20px] leading-snug tracking-tight">
            {product.name}
          </h3>
        </div>

        {/* Amount-mode segmented control (only when >1 mode is available) */}
        {modes.length > 1 ? (
          <div
            className="grid rounded-xl bg-[#F5F4F0] p-1"
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
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-2 font-medium font-sans-display text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
                  mode === m
                    ? 'bg-white text-[#2C2416] shadow-sm'
                    : 'text-[#8B8682] hover:text-[#2C2416]'
                }`}
              >
                {modeLabel[m]}
              </button>
            ))}
          </div>
        ) : null}

        {/* Amount control */}
        {mode === 'serving' && servingSizeG ? (
          <div className="space-y-2">
            <label htmlFor="servings-input" className={FIELD_LABEL}>
              {t('barcodeServingsLabel')}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustServings(-1)}
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
                  setServings(
                    Math.min(
                      MAX_SERVINGS,
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    )
                  )
                }
                className={NUMBER_INPUT}
              />
              <button
                type="button"
                onClick={() => adjustServings(1)}
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

        {mode === 'package' && packageSizeG ? (
          <div className="flex items-center justify-between rounded-[20px] border border-[#EAE7E0] bg-white px-4 py-3">
            <span className="font-sans-display text-[#8B8682] text-[14px]">
              {t('barcodeWholePackage')}
            </span>
            <span className="font-normal font-serif text-[#2C2416] text-[22px] tabular-nums">
              {t('barcodeTotalGrams', { grams })}
            </span>
          </div>
        ) : null}

        {mode === 'grams' ? (
          <div className="space-y-2">
            <label htmlFor="grams-input" className={FIELD_LABEL}>
              {t('barcodeGramsLabel')}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustGrams(-GRAM_STEP)}
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
                  setCustomGrams(
                    clampGrams(Number.parseInt(e.target.value, 10) || 0)
                  )
                }
                className={NUMBER_INPUT}
              />
              <button
                type="button"
                onClick={() => adjustGrams(GRAM_STEP)}
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
                  onClick={() => setCustomGrams(val)}
                  className={`rounded-full border px-3 py-1 font-sans-display text-[13px] tabular-nums transition-colors ${
                    customGrams === val
                      ? 'border-[#C9A87C]/50 bg-[#C9A87C]/15 text-[#2C2416]'
                      : 'border-[#EAE7E0] bg-white text-[#8B8682] hover:bg-[#F5F4F0]'
                  }`}
                >
                  {val}g
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Nutrition for the selected amount — big Lora calorie figure with a
            tabular macro row underneath (per-amount, not per-100g). */}
        <div className="rounded-[20px] border border-[#EAE7E0] bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-sans-display text-[#8B8682] text-[12px]">
              {t('barcodeNutritionForAmount', { grams })}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-normal font-serif text-[#2C2416] text-[26px] tabular-nums leading-none">
                {calories !== null ? calories : '--'}
              </span>
              <span className="font-sans-display text-[#8B8682] text-[12px]">
                kcal
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-[#EAE7E0] border-t pt-3">
            {macros.map((macro) => (
              <div key={macro.label} className="text-center">
                <span className="block font-medium font-sans-display text-[#8B8682] text-[10px] uppercase tracking-wide">
                  {macro.label}
                </span>
                <span className="mt-0.5 block font-sans-display font-semibold text-[#2C2416] text-[15px] tabular-nums">
                  {macro.value !== null ? `${macro.value}g` : '--'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/70 border-t bg-[#F5F4F0]/50 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex touch-manipulation items-center gap-2 font-medium font-sans-display text-[#8B8682] text-[14px] transition-colors hover:text-[#2C2416]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('barcodeBack')}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(grams)}
          disabled={isStaging || grams <= 0}
          aria-busy={isStaging}
          className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2C2416] px-5 py-2.5 font-medium font-sans-display text-[#FDFCF8] text-[14px] shadow-sm transition-colors hover:bg-[#1C1917] disabled:opacity-50"
        >
          {isStaging ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('analyzing')}
            </>
          ) : (
            t('barcodeAddMeal')
          )}
        </button>
      </div>
    </div>
  );
}
