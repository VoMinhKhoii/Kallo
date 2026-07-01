'use client';

import { ChevronLeft, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';

const GRAM_STEP = 50;
const MAX_GRAMS = 10_000;
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

interface NutrientCellProps {
  label: string;
  value: number | null;
  unit: string;
}

function NutrientCell({ label, value, unit }: NutrientCellProps) {
  return (
    <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
      <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
        {label}
      </span>
      <span className="font-[var(--font-lora)] font-normal text-base text-nham-text">
        {value !== null ? value : '--'}
      </span>
      <span className="block text-[9px] text-nham-text-muted">{unit}</span>
    </div>
  );
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

  return (
    <div className="space-y-6">
      {/* Product Header */}
      <div className="border-nham-border/40 border-b pb-3">
        {product.brand ? (
          <span className="font-[var(--font-dm-sans)] text-nham-text-muted text-xs uppercase tracking-wider">
            {product.brand}
          </span>
        ) : null}
        <h3 className="font-[var(--font-lora)] font-normal text-nham-text text-xl">
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
              className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium text-xs transition-all duration-200 ${
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
              className="font-medium text-nham-text-muted text-sm"
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
                className="border-nham-border/60 bg-background text-center font-medium focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
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
            <span className="block text-nham-text-muted text-xs">
              {t('barcodePerServing', { grams: servingSizeG })} ·{' '}
              {t('barcodeTotalGrams', { grams })}
            </span>
          </div>
        ) : null}

        {mode === 'package' && packageSizeG ? (
          <div className="rounded-xl border border-nham-border/30 bg-background p-3 text-center">
            <span className="block text-nham-text-muted text-xs">
              {t('barcodeWholePackage')}
            </span>
            <span className="font-[var(--font-lora)] text-lg text-nham-text">
              {t('barcodeTotalGrams', { grams })}
            </span>
          </div>
        ) : null}

        {mode === 'grams' ? (
          <div className="space-y-2">
            <label
              htmlFor="grams-input"
              className="font-medium text-nham-text-muted text-sm"
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
                className="border-nham-border/60 bg-background text-center font-medium focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
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
            <div className="flex gap-2 pt-1">
              {QUICK_GRAM_OPTIONS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCustomGrams(val)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                    customGrams === val
                      ? 'border-nham-accent/60 bg-nham-cheat-fill text-nham-text'
                      : 'border-nham-border/30 bg-background text-nham-text-muted hover:bg-nham-hover'
                  }`}
                >
                  {val}g
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Nutrition for the selected amount */}
      <div className="space-y-2">
        <span className="text-nham-text-muted text-xs">
          {t('barcodeNutritionForAmount', { grams })}
        </span>
        <div className="grid grid-cols-4 gap-2">
          <NutrientCell
            label={t('barcodeCalories')}
            value={scaleValue(product.caloriesKcal, grams, 0)}
            unit="kcal"
          />
          <NutrientCell
            label={t('barcodeProtein')}
            value={scaleValue(product.proteinG, grams, 1)}
            unit="g"
          />
          <NutrientCell
            label={t('barcodeCarbs')}
            value={scaleValue(product.carbohydrateG, grams, 1)}
            unit="g"
          />
          <NutrientCell
            label={t('barcodeFat')}
            value={scaleValue(product.fatG, grams, 1)}
            unit="g"
          />
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
