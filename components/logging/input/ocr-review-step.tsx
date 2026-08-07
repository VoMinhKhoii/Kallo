'use client';

import { ArrowLeft, Check, Flame, Loader2, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
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
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {/* Product Name */}
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

        {/* Portion Selector */}
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
              <span className="w-12 text-center font-bold text-nham-ink">
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

        {/* Extracted Nutrients Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3">
            <div className="flex items-center gap-1.5 text-[#8B8682] text-[12px]">
              <Flame className="h-3.5 w-3.5 text-nham-accent" />
              <span>{t('calories')}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <Input
                type="number"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="h-8 w-20 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
              />
              <span className="text-[#8B8682] text-[12px]">kcal</span>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3">
            <span className="text-[#8B8682] text-[12px]">
              {t('barcodeProtein')}
            </span>
            <div className="flex items-baseline gap-1">
              <Input
                type="number"
                step="0.1"
                value={proteinGrams}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="h-8 w-16 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
              />
              <span className="text-[#8B8682] text-[12px]">g</span>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3">
            <span className="text-[#8B8682] text-[12px]">
              {t('barcodeCarbs')}
            </span>
            <div className="flex items-baseline gap-1">
              <Input
                type="number"
                step="0.1"
                value={carbsGrams}
                onChange={(e) => setCarbs(Number(e.target.value))}
                className="h-8 w-16 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
              />
              <span className="text-[#8B8682] text-[12px]">g</span>
            </div>
          </div>

          <div className="space-y-1 rounded-xl border border-[#EAE7E0] bg-white p-3">
            <span className="text-[#8B8682] text-[12px]">
              {t('barcodeFat')}
            </span>
            <div className="flex items-baseline gap-1">
              <Input
                type="number"
                step="0.1"
                value={fatGrams}
                onChange={(e) => setFat(Number(e.target.value))}
                className="h-8 w-16 border-none p-0 font-bold text-[18px] text-nham-ink focus-visible:ring-0"
              />
              <span className="text-[#8B8682] text-[12px]">g</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
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
