'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { BarcodeAmountControls } from '@/components/logging/input/barcode/product/barcode-amount-controls';
import { BarcodeNutritionPreview } from '@/components/logging/input/barcode/product/barcode-nutrition-preview';
import { BarcodeProductHeader } from '@/components/logging/input/barcode/product/barcode-product-header';
import {
  type AmountMode,
  availableAmountModes,
  clampGrams,
  clampServings,
  resolveGrams,
} from '@/lib/domain/barcode/amount';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/openfoodfacts';

interface BarcodeProductStepProps {
  product: ParsedBarcodeProduct;
  isStaging: boolean;
  onBack: () => void;
  /** Called with the resolved amount, in the product's unit, to stage. */
  onConfirm: (grams: number) => void;
}

/** The "quantity" step of the barcode dialog. Lets the user pick an amount by
 *  serving, whole package, or a custom amount (grams, or millilitres for a
 *  drink) — offering only the modes the
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
  const { servingSizeG, packageSizeG, amountUnit: unit } = product;

  const modes = useMemo<AmountMode[]>(
    () => availableAmountModes({ servingSizeG, packageSizeG }),
    [servingSizeG, packageSizeG]
  );

  const [mode, setMode] = useState<AmountMode>(modes[0]);
  const [servings, setServings] = useState(1);
  const [customGrams, setCustomGrams] = useState(
    clampGrams(Math.round(servingSizeG ?? packageSizeG ?? 100))
  );

  const grams = resolveGrams(mode, {
    servings,
    customGrams,
    servingSizeG,
    packageSizeG,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <BarcodeProductHeader product={product} />

        <BarcodeAmountControls
          modes={modes}
          mode={mode}
          onModeChange={setMode}
          servings={servings}
          onAdjustServings={(delta) =>
            setServings((s) => clampServings(s + delta))
          }
          onSetServings={(value) => setServings(clampServings(value))}
          customGrams={customGrams}
          onAdjustGrams={(delta) =>
            setCustomGrams((g) => clampGrams(g + delta))
          }
          onSetGrams={(value) => setCustomGrams(clampGrams(value))}
          grams={grams}
          servingSizeG={servingSizeG}
          unit={unit}
        />

        {mode === 'package' && packageSizeG ? (
          <div className="flex items-center justify-between rounded-[20px] border border-[#EAE7E0] bg-white px-4 py-3">
            <span className="font-sans-display text-[#8B8682] text-[14px]">
              {t('barcodeWholePackage')}
            </span>
            <span className="font-normal font-sans-display text-[22px] text-kallo-text tabular-nums">
              {t('barcodeTotalGrams', { amount: grams, unit })}
            </span>
          </div>
        ) : null}

        <BarcodeNutritionPreview product={product} amount={grams} />
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/70 border-t bg-kallo-track/50 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex touch-manipulation items-center gap-2 font-medium font-sans-display text-[#8B8682] text-[14px] transition-colors hover:text-kallo-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('barcodeBack')}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(grams)}
          disabled={isStaging || grams <= 0}
          aria-busy={isStaging}
          className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-kallo-ink px-5 py-2.5 font-medium font-sans-display text-[#FDFCF8] text-[14px] shadow-sm transition-colors hover:bg-[#1C1917] disabled:opacity-50"
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
