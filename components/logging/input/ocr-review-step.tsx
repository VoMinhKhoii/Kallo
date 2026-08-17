'use client';

import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type {
  OcrReviewPayload,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr-schema';
import { type MacroItem, OcrNutrientGrid } from './ocr-nutrient-grid';
import { OcrReviewMetadata } from './ocr-review-metadata';
import {
  OCR_MACRO_DEFINITIONS,
  OCR_MICRONUTRIENT_DEFINITIONS,
} from './ocr-review-nutrients';
import { OcrReviewQuantity } from './ocr-review-quantity';
import { useOcrReviewState } from './use-ocr-review-state';

export interface OcrReviewStepProps {
  data: ParsedNutritionLabel | null;
  isStaging: boolean;
  onBack: () => void;
  onConfirm: (payload: OcrReviewPayload) => void;
}

const BASIS_KEYS = {
  per_100g: 'per100g',
  per_100ml: 'per100ml',
  per_serving: 'perServing',
  per_container: 'perContainer',
  per_100g_and_serving: 'per100gAndServing',
  per_100ml_and_serving: 'per100mlAndServing',
} as const;

export function OcrReviewStep({
  data,
  isStaging,
  onBack,
  onConfirm,
}: OcrReviewStepProps) {
  const t = useTranslations('logging');
  const [hasInteracted, setHasInteracted] = useState(false);
  const review = useOcrReviewState(data, t('ocrDefaultProductName'));
  const toItem = (
    definition: (typeof OCR_MACRO_DEFINITIONS)[number],
    required = false
  ): MacroItem => ({
    id: `ocr-nutrient-${definition.key}`,
    label: t(`ocrNutrients.${definition.labelKey}`),
    val: review.getNutrientText(definition.key),
    unit: definition.unit,
    icon: definition.key === 'calories',
    required,
    hasError: review.nutrientHasError(definition.key),
    errorText: t('ocrInvalidNutrient'),
    setter: (value) => review.setNutrientText(definition.key, value),
  });
  const macroItems = OCR_MACRO_DEFINITIONS.map((definition) =>
    toItem(definition, true)
  );
  const micronutrientItems = OCR_MICRONUTRIENT_DEFINITIONS.filter(
    (definition) => review.initialNutrition[definition.key] !== null
  ).map((definition) => toItem(definition));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const { calories, proteinGrams, carbsGrams, fatGrams } = review.nutrition;
    if (
      !review.canConfirm ||
      review.parsedAmount === null ||
      calories === null ||
      proteinGrams === null ||
      carbsGrams === null ||
      fatGrams === null
    ) {
      return;
    }
    onConfirm({
      ...review.nutrition,
      productName: review.productName.trim(),
      amount: review.parsedAmount,
      unit: review.unit,
      confidence: data?.confidence ?? 'low',
      calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setHasInteracted(true)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="space-y-1.5">
          <label
            htmlFor="ocr-product-name"
            className="font-medium text-[#8B8682] text-[12px]"
          >
            {t('ocrProductName')}
          </label>
          <Input
            id="ocr-product-name"
            type="text"
            value={review.productName}
            aria-invalid={!review.productIsValid}
            aria-describedby={
              !review.productIsValid ? 'ocr-product-name-error' : undefined
            }
            onChange={(event) => review.setProductName(event.target.value)}
            className="rounded-xl border-[#EAE7E0] bg-white text-[14px] text-kallo-text focus-visible:border-kallo-accent"
          />
          {!review.productIsValid && (
            <p
              id="ocr-product-name-error"
              role="alert"
              className="text-kallo-danger text-xs"
            >
              {t('ocrInvalidProductName')}
            </p>
          )}
        </div>

        {data && (
          <OcrReviewMetadata
            basis={t(`ocrBasis.${BASIS_KEYS[data.basis]}`)}
            confidence={t(`ocrConfidence.${data.confidence}`)}
            servingDescription={review.servingDescription}
            servingsPerContainer={review.servingsPerContainer}
            basisLabel={t('ocrBasisLabel')}
            confidenceLabel={t('ocrConfidenceLabel')}
            servingLabel={t('ocrServingDescriptionLabel')}
            servingsPerContainerLabel={t('ocrServingsPerContainerLabel')}
          />
        )}

        <OcrReviewQuantity
          amountText={review.amountText}
          unit={
            review.unit === 'serving'
              ? t('ocrUnit.serving', { count: review.parsedAmount ?? 0 })
              : t(`ocrUnit.${review.unit}`)
          }
          amountIsValid={review.amountIsValid}
          servingAmount={review.servingAmount}
          packageAmount={review.packageAmount}
          amountLabel={t('ocrAmountLabel')}
          invalidText={t('ocrInvalidAmount')}
          servingText={t('ocrServingShortcut')}
          packageText={t('ocrPackageShortcut')}
          decreaseLabel={t('ocrDecreaseAmount')}
          increaseLabel={t('ocrIncreaseAmount')}
          onChange={review.setAmountText}
          onCommit={review.commitAmount}
        />

        <OcrNutrientGrid items={macroItems} />
        {hasInteracted && !review.canConfirm && (
          <p role="alert" className="text-[12px] text-kallo-danger">
            {t('ocrRequiredValues')}
          </p>
        )}
        {micronutrientItems.length > 0 && (
          <OcrNutrientGrid items={micronutrientItems} />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/70 border-t bg-kallo-track/50 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isStaging}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-[#8B8682] text-[13px] hover:text-kallo-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('barcodeBack')}
        </button>
        <button
          type="submit"
          disabled={isStaging || !review.canConfirm}
          className="inline-flex touch-manipulation items-center gap-2 rounded-xl bg-kallo-ink px-5 py-2.5 font-medium text-[14px] text-white shadow-sm hover:bg-[#1C1917] disabled:opacity-50"
        >
          {isStaging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t('confirm')}
        </button>
      </div>
    </form>
  );
}
