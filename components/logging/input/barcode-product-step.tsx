'use client';

import { ChevronLeft, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';

const GRAM_STEP = 50;
const MAX_GRAMS = 10_000;
const QUICK_GRAM_OPTIONS = [50, 100, 150, 200, 250];

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
  grams: number;
  onGramsChange: (grams: number) => void;
  isStaging: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/** The "quantity" step of the barcode dialog: shows the resolved product's
 *  per-100g nutrition and lets the user pick a gram amount before staging it
 *  as a pending meal. Purely presentational — all state lives in the dialog. */
export function BarcodeProductStep({
  product,
  grams,
  onGramsChange,
  isStaging,
  onBack,
  onConfirm,
}: BarcodeProductStepProps) {
  const t = useTranslations('logging');

  const adjustGrams = (amount: number) => {
    onGramsChange(Math.min(MAX_GRAMS, Math.max(1, grams + amount)));
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

      {/* Nutrition Profile per 100g */}
      <div className="space-y-2">
        <span className="text-nham-text-muted text-xs">
          {t('barcodeNutritionPer100g')}
        </span>
        <div className="grid grid-cols-4 gap-2">
          <NutrientCell
            label={t('barcodeCalories')}
            value={
              product.caloriesKcal !== null
                ? Math.round(product.caloriesKcal)
                : null
            }
            unit="kcal"
          />
          <NutrientCell
            label={t('barcodeProtein')}
            value={product.proteinG}
            unit="g"
          />
          <NutrientCell
            label={t('barcodeCarbs')}
            value={product.carbohydrateG}
            unit="g"
          />
          <NutrientCell label={t('barcodeFat')} value={product.fatG} unit="g" />
        </div>
      </div>

      {/* Quantity Input */}
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
            disabled={grams <= GRAM_STEP}
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
            value={grams}
            onChange={(e) =>
              onGramsChange(
                Math.min(
                  MAX_GRAMS,
                  Math.max(1, Number.parseInt(e.target.value, 10) || 0)
                )
              )
            }
            className="border-nham-border/60 bg-background text-center font-medium focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => adjustGrams(GRAM_STEP)}
            disabled={grams >= MAX_GRAMS}
            aria-label={t('barcodeIncreaseGrams')}
            className="border-nham-border/60 hover:bg-nham-hover"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick select chips */}
        <div className="flex gap-2 pt-1">
          {QUICK_GRAM_OPTIONS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onGramsChange(val)}
              className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                grams === val
                  ? 'border-nham-accent/60 bg-nham-cheat-fill text-nham-text'
                  : 'border-nham-border/30 bg-background text-nham-text-muted hover:bg-nham-hover'
              }`}
            >
              {val}g
            </button>
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
          onClick={onConfirm}
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
