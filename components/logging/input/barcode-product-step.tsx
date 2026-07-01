'use client';

import { ChevronLeft, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
 *  on barcode by the dialog) so the defaults re-initialize on each scan. */
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
    <div className="space-y-5">
      {/* Product Header */}
      <div className="border-nham-border/40 border-b pb-3">
        {product.brand ? (
          <span className="font-medium font-sans-display text-[11px] text-nham-text-muted uppercase tracking-[0.12em]">
            {product.brand}
          </span>
        ) : null}
        <h3 className="font-normal font-serif text-[20px] text-nham-text leading-snug">
          {product.name}
        </h3>
      </div>

      {/* Amount mode selector (only when the product offers more than grams) */}
      {modes.length > 1 ? (
        <div
          className="flex rounded-lg border border-nham-border/20 bg-nham-hover/30 p-1"
          role="group"
          aria-label={t('barcodeAmountModeLabel')}
        >
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium font-sans-display text-xs transition-all duration-200 ${
                mode === m
                  ? 'bg-nham-btn text-white shadow-sm'
                  : 'text-nham-text-muted hover:bg-nham-hover/50 hover:text-nham-text'
              }`}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>
      ) : null}

      {/* Amount control */}
      <div className="space-y-2">
        {mode === 'serving' && servingSizeG ? (
          <div className="space-y-2">
            <label
              htmlFor="servings-input"
              className="font-medium font-sans-display text-nham-text-muted text-sm"
            >
              {t('barcodeServingsLabel')}
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustServings(-1)}
                disabled={servings <= 1}
                aria-label={t('barcodeDecreaseServings')}
                className="border-nham-border/60 hover:bg-nham-hover"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
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
                className="border-nham-border/60 bg-background text-center font-medium tabular-nums focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustServings(1)}
                disabled={servings >= MAX_SERVINGS}
                aria-label={t('barcodeIncreaseServings')}
                className="border-nham-border/60 hover:bg-nham-hover"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="block font-sans-display text-nham-text-muted text-xs tabular-nums">
              {t('barcodePerServing', { grams: servingSizeG })} ·{' '}
              {t('barcodeTotalGrams', { grams })}
            </span>
          </div>
        ) : null}

        {mode === 'package' && packageSizeG ? (
          <div className="flex items-center justify-between rounded-2xl border border-nham-border/40 bg-white px-4 py-3">
            <span className="font-sans-display text-nham-text-muted text-sm">
              {t('barcodeWholePackage')}
            </span>
            <span className="font-normal font-serif text-[22px] text-nham-text tabular-nums">
              {t('barcodeTotalGrams', { grams })}
            </span>
          </div>
        ) : null}

        {mode === 'grams' ? (
          <div className="space-y-2">
            <label
              htmlFor="grams-input"
              className="font-medium font-sans-display text-nham-text-muted text-sm"
            >
              {t('barcodeGramsLabel')}
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustGrams(-GRAM_STEP)}
                disabled={customGrams <= 1}
                aria-label={t('barcodeDecreaseGrams')}
                className="border-nham-border/60 hover:bg-nham-hover"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
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
                className="border-nham-border/60 bg-background text-center font-medium tabular-nums focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => adjustGrams(GRAM_STEP)}
                disabled={customGrams >= MAX_GRAMS}
                aria-label={t('barcodeIncreaseGrams')}
                className="border-nham-border/60 hover:bg-nham-hover"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_GRAM_OPTIONS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCustomGrams(val)}
                  className={`rounded-full border px-3 py-1 font-sans-display text-xs tabular-nums transition-colors duration-200 ${
                    customGrams === val
                      ? 'border-nham-accent/40 bg-nham-accent/15 text-nham-text'
                      : 'border-nham-border/50 bg-white text-nham-text-muted hover:bg-nham-hover/50'
                  }`}
                >
                  {val}g
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Nutrition for the selected amount — big Lora calorie figure with a
          tabular macro row underneath (per-amount, not per-100g). */}
      <div className="rounded-2xl border border-nham-border/40 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-sans-display text-nham-text-muted text-xs">
            {t('barcodeNutritionForAmount', { grams })}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-normal font-serif text-[26px] text-nham-text tabular-nums leading-none">
              {calories !== null ? calories : '--'}
            </span>
            <span className="font-sans-display text-nham-text-muted text-xs">
              kcal
            </span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-nham-border/30 border-t pt-3">
          {macros.map((macro) => (
            <div key={macro.label} className="text-center">
              <span className="block font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-wide">
                {macro.label}
              </span>
              <span className="mt-0.5 block font-sans-display font-semibold text-[15px] text-nham-text tabular-nums">
                {macro.value !== null ? `${macro.value}g` : '--'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('barcodeBack')}
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(grams)}
          disabled={isStaging || grams <= 0}
          aria-busy={isStaging}
          className="bg-nham-btn text-white hover:bg-nham-btn-hover active:scale-95 disabled:opacity-50"
        >
          {isStaging ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('analyzing')}
            </>
          ) : (
            t('barcodeAddMeal')
          )}
        </Button>
      </div>
    </div>
  );
}
