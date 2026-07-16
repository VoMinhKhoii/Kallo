'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import type { CarbOption, Screen1FormData } from './constants';

/** Macro-summary header + the three carb-split target cards. */
export function CarbSplitPicker({
  form,
  reportChange,
  targetCalories,
  carbOptions,
}: {
  form: UseFormReturn<Screen1FormData>;
  reportChange: () => void;
  targetCalories: number;
  carbOptions: CarbOption[];
}) {
  const t = useTranslations('onboarding');
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <label className="block font-bold text-[11px] text-nham-stone uppercase tracking-widest">
          {t('bodyMetrics.macroSummary')}
        </label>
        <div className="font-normal font-serif text-2xl text-nham-text">
          {targetCalories}{' '}
          <span className="font-sans text-[#8B8682] text-sm">
            {t('bodyMetrics.kcal')}
          </span>
        </div>
      </div>
      <FormField
        control={form.control}
        name="carbSplit"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="grid gap-2.5 lg:grid-cols-3">
                {carbOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      field.onChange(opt.id);
                      reportChange();
                    }}
                    className={`overflow-hidden rounded-[22px] border text-left transition-all ${
                      field.value === opt.id
                        ? 'border-nham-accent bg-[#FFF8EF] shadow-[0_10px_24px_rgba(201,168,124,0.14)]'
                        : 'border-[#EAE7E0] bg-white hover:border-nham-accent/50'
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2.5 ${
                        field.value === opt.id
                          ? 'bg-[#FBF2E6] text-nham-text'
                          : 'bg-nham-track text-nham-text'
                      }`}
                    >
                      <div className="font-medium text-[13px]">{opt.label}</div>
                      <div
                        className={`mt-0.5 text-[10px] ${
                          field.value === opt.id
                            ? 'text-[#6F6556]'
                            : 'text-[#8B8682]'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </div>
                    <div className="px-3.5 py-3">
                      <div className="space-y-1.5 text-[11px]">
                        {[
                          {
                            label: t('bodyMetrics.protein'),
                            value: opt.macros.proteinG,
                          },
                          {
                            label: t('bodyMetrics.fat'),
                            value: opt.macros.fatG,
                          },
                          {
                            label: t('bodyMetrics.carbs'),
                            value: opt.macros.carbsG,
                          },
                        ].map((macro) => (
                          <div
                            key={macro.label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-[#6F6556] text-[10px] uppercase tracking-wide">
                              {macro.label}
                            </span>
                            <span className="font-semibold text-[12px] text-nham-text">
                              {macro.value}
                              {t('bodyMetrics.grams')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
