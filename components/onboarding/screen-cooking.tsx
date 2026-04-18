'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { NEUTRAL_COOKING_DEFAULTS } from '@/lib/onboarding/constants';
import {
  type CookingHabitsInput,
  cookingHabitsSchema,
} from '@/lib/onboarding/schemas';
import type { CookingHabits } from '@/lib/onboarding/types';

interface ScreenCookingProps {
  defaultValues: Partial<CookingHabits>;
  onChange: (data: CookingHabits) => void;
}

function allCookingFieldsNull(values: Partial<CookingHabits>): boolean {
  return (
    !values.oilUsage &&
    !values.defaultRicePortion &&
    !values.sugarBraised &&
    !values.defaultProteinPortion &&
    !values.brothConsumption
  );
}

interface OptionStripItem {
  value: string;
  label: string;
  hint?: string;
}

function OptionStrip({
  options,
  value,
  onChange,
}: {
  options: OptionStripItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-xl bg-[#F5F4F0] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex min-w-0 flex-col items-center rounded-lg px-2 py-2.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/30 ${
            value === opt.value
              ? 'bg-white text-[#2C2416] shadow-sm'
              : 'text-[#8B8682] hover:text-[#2C2416]'
          }`}
        >
          <span className="font-medium text-[13px]">{opt.label}</span>
          {opt.hint && (
            <span className="mt-1 line-clamp-2 text-[10px] leading-tight opacity-70 sm:line-clamp-none">
              {opt.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ScreenCooking({ defaultValues, onChange }: ScreenCookingProps) {
  const t = useTranslations('onboarding');
  const hasPrePopulated = useRef(false);

  const initialDefaults = allCookingFieldsNull(defaultValues)
    ? NEUTRAL_COOKING_DEFAULTS
    : (defaultValues as CookingHabits);

  const form = useForm<CookingHabitsInput>({
    resolver: zodResolver(cookingHabitsSchema),
    defaultValues: initialDefaults,
    mode: 'onBlur',
  });

  const reportChange = useCallback(() => {
    const v = form.getValues();
    onChange(v as CookingHabits);
  }, [form, onChange]);

  // One-time pre-population with neutral defaults
  useEffect(() => {
    if (!hasPrePopulated.current && allCookingFieldsNull(defaultValues)) {
      for (const [key, val] of Object.entries(NEUTRAL_COOKING_DEFAULTS)) {
        form.setValue(key as any, val);
      }
      form.trigger();
      onChange(NEUTRAL_COOKING_DEFAULTS);
      hasPrePopulated.current = true;
    }
  }, [defaultValues, form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-6 lg:space-y-7">
        <div className="max-w-2xl">
          <h2
            className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('cooking.title')}
          </h2>
          <p
            className="text-[#8B8682] text-[15px] leading-relaxed"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {t('cooking.subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Oil usage */}
          <FormField
            control={form.control}
            name="oilUsage"
            render={({ field }) => (
              <FormItem className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  {t('cooking.oilUsage')}
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'minimal',
                        label: t('cooking.oilMinimal'),
                        hint: t('cooking.oilMinimalHint'),
                      },
                      {
                        value: 'normal',
                        label: t('cooking.oilNormal'),
                        hint: t('cooking.oilNormalHint'),
                      },
                      {
                        value: 'heavy',
                        label: t('cooking.oilHeavy'),
                        hint: t('cooking.oilHeavyHint'),
                      },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Rice per meal */}
          <FormField
            control={form.control}
            name="defaultRicePortion"
            render={({ field }) => (
              <FormItem className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  {t('cooking.ricePortion')}
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'small',
                        label: t('cooking.riceSmall'),
                        hint: t('cooking.riceSmallHint'),
                      },
                      {
                        value: 'medium',
                        label: t('cooking.riceMedium'),
                        hint: t('cooking.riceMediumHint'),
                      },
                      {
                        value: 'large',
                        label: t('cooking.riceLarge'),
                        hint: t('cooking.riceLargeHint'),
                      },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Sugar in braised */}
          <FormField
            control={form.control}
            name="sugarBraised"
            render={({ field }) => (
              <FormItem className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  {t('cooking.sugar')}
                </FormLabel>
                <FormDescription className="-mt-1 mb-3 text-[#8B8682] text-[12px] leading-relaxed">
                  {t('cooking.sugarHint')}
                </FormDescription>
                <FormControl>
                  <OptionStrip
                    options={[
                      { value: 'low', label: t('cooking.sugarLow') },
                      { value: 'medium', label: t('cooking.sugarMedium') },
                      { value: 'high', label: t('cooking.sugarHigh') },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Protein portion */}
          <FormField
            control={form.control}
            name="defaultProteinPortion"
            render={({ field }) => (
              <FormItem className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  {t('cooking.proteinPortion')}
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'small',
                        label: t('cooking.proteinSmall'),
                        hint: t('cooking.proteinSmallHint'),
                      },
                      {
                        value: 'medium',
                        label: t('cooking.proteinMedium'),
                        hint: t('cooking.proteinMediumHint'),
                      },
                      {
                        value: 'large',
                        label: t('cooking.proteinLarge'),
                        hint: t('cooking.proteinLargeHint'),
                      },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Broth consumption */}
          <FormField
            control={form.control}
            name="brothConsumption"
            render={({ field }) => (
              <FormItem className="rounded-[24px] border border-[#EAE7E0] bg-white p-5 sm:p-6">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  {t('cooking.broth')}
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'leave_it',
                        label: t('cooking.brothLeave'),
                        hint: t('cooking.brothLeaveHint'),
                      },
                      {
                        value: 'some',
                        label: t('cooking.brothSome'),
                        hint: t('cooking.brothSomeHint'),
                      },
                      {
                        value: 'finish_it',
                        label: t('cooking.brothFinish'),
                        hint: t('cooking.brothFinishHint'),
                      },
                    ]}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      reportChange();
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
