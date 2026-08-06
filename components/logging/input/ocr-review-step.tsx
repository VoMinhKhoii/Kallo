'use client';

import { ArrowLeft, Check, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
import { OcrNutrientGrid } from './ocr-nutrient-grid';

import { useOcrReviewState } from './use-ocr-review-state';

interface OcrReviewStepProps {
  data: ParsedNutritionLabel;
  isStaging: boolean;
  onBack: () => void;
  onConfirm: (payload: {
    productName: string;
    grams: number;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    [key: string]: string | number | null | undefined;
  }) => void;
}

export function OcrReviewStep({
  data,
  isStaging,
  onBack,
  onConfirm,
}: OcrReviewStepProps) {
  const t = useTranslations('logging');
  const {
    productName,
    setProductName,
    grams,
    unit,
    handleGramsChange,
    calories,
    setCalories,
    proteinGrams,
    setProtein,
    carbsGrams,
    setCarbs,
    fatGrams,
    setFat,
    getBaseValue,
    scaleMicro,
  } = useOcrReviewState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      productName: productName.trim() || 'Scanned Packaged Food',
      grams,
      calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      fiberGrams: scaleMicro(getBaseValue('fiberGrams')),
      sodiumMg: scaleMicro(getBaseValue('sodiumMg')),
      calciumMg: scaleMicro(getBaseValue('calciumMg')),
      ironMg: scaleMicro(getBaseValue('ironMg')),
      potassiumMg: scaleMicro(getBaseValue('potassiumMg')),
      vitaminAMcg: scaleMicro(getBaseValue('vitaminAMcg')),
      vitaminCMg: scaleMicro(getBaseValue('vitaminCMg')),
      vitaminDMcg: scaleMicro(getBaseValue('vitaminDMcg')),
    });
  };

  const macros = [
    {
      label: t('calories'),
      val: calories,
      unit: 'kcal',
      icon: true,
      step: '1',
      setter: setCalories,
    },
    {
      label: t('barcodeProtein'),
      val: proteinGrams,
      unit: 'g',
      icon: false,
      step: '0.1',
      setter: setProtein,
    },
    {
      label: t('barcodeCarbs'),
      val: carbsGrams,
      unit: 'g',
      icon: false,
      step: '0.1',
      setter: setCarbs,
    },
    {
      label: t('barcodeFat'),
      val: fatGrams,
      unit: 'g',
      icon: false,
      step: '0.1',
      setter: setFat,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="space-y-1.5">
          <label className="font-medium font-sans-display text-[#8B8682] text-[12px]">
            Product Name
          </label>
          <Input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="rounded-xl border-[#EAE7E0] bg-white font-sans-display text-[14px] text-nham-text focus-visible:border-nham-accent"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-[#EAE7E0] bg-nham-track/30 p-3.5">
          <div className="flex items-center justify-between font-medium text-[13px] text-nham-text">
            <span>{t('barcodeGramsLabel')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGramsChange(grams - 10)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#EAE7E0] bg-white hover:bg-nham-track"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-14 text-center font-bold text-nham-ink">
                {grams}
                {unit}
              </span>
              <button
                type="button"
                onClick={() => handleGramsChange(grams + 10)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#EAE7E0] bg-white hover:bg-nham-track"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <OcrNutrientGrid items={macros} />
      </div>

      <div className="flex shrink-0 items-center justify-between border-[#EAE7E0]/70 border-t bg-nham-track/50 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isStaging}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-[#8B8682] text-[13px] hover:text-nham-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('barcodeBack')}
        </button>
        <button
          type="submit"
          disabled={isStaging}
          className="inline-flex touch-manipulation items-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium text-[14px] text-white shadow-sm hover:bg-[#1C1917] disabled:opacity-50"
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
