'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { REGIONAL_COOKING_DEFAULTS } from '@/lib/onboarding/constants';
import {
  type CookingHabitsInput,
  cookingHabitsSchema,
} from '@/lib/onboarding/schemas';
import type { CookingHabits, RegionalProfile } from '@/lib/onboarding/types';

interface ScreenCookingProps {
  defaultValues: Partial<CookingHabits>;
  regionalProfile: RegionalProfile | null;
  onChange: (data: CookingHabits) => void;
}

const NEUTRAL_DEFAULTS: CookingHabits = {
  oilUsage: 'normal',
  fatTrim: 'eat_all',
  boneAwareness: false,
  defaultRicePortion: 'medium',
  sugarBraised: 'medium',
};

function allCookingFieldsNull(values: Partial<CookingHabits>): boolean {
  return (
    !values.oilUsage &&
    !values.fatTrim &&
    !values.boneAwareness &&
    !values.defaultRicePortion &&
    !values.sugarBraised
  );
}

export function ScreenCooking({
  defaultValues,
  regionalProfile,
  onChange,
}: ScreenCookingProps) {
  const hasPrePopulated = useRef(false);

  // Determine initial values for the form
  const initialDefaults = (() => {
    if (!allCookingFieldsNull(defaultValues)) {
      // Resuming with saved values
      return defaultValues as CookingHabits;
    }
    if (regionalProfile) {
      return REGIONAL_COOKING_DEFAULTS[regionalProfile];
    }
    return NEUTRAL_DEFAULTS;
  })();

  const form = useForm<CookingHabitsInput>({
    resolver: zodResolver(cookingHabitsSchema),
    defaultValues: initialDefaults,
    mode: 'onBlur',
  });

  const reportChange = useCallback(() => {
    const v = form.getValues();
    onChange(v as CookingHabits);
  }, [form, onChange]);

  // One-time pre-population with useRef guard
  useEffect(() => {
    if (
      !hasPrePopulated.current &&
      allCookingFieldsNull(defaultValues) &&
      regionalProfile
    ) {
      const defaults = REGIONAL_COOKING_DEFAULTS[regionalProfile];
      for (const [key, val] of Object.entries(defaults)) {
        form.setValue(key as any, val);
      }
      form.trigger();
      onChange(defaults);
      hasPrePopulated.current = true;
    }
  }, [defaultValues, regionalProfile, form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-8">
        <div>
          <h2
            className="mb-2 font-medium text-2xl text-[#2C2416] tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Cooking Habits
          </h2>
          <p
            className="text-[#8B8682] text-[15px] leading-relaxed"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Pre-populated based on your{' '}
            <strong className="font-medium text-[#2C2416]">
              {regionalProfile
                ? {
                    mien_bac: 'Miền Bắc',
                    mien_trung: 'Miền Trung',
                    mien_nam: 'Miền Nam',
                    mien_tay: 'Miền Tây',
                  }[regionalProfile]
                : '—'}
            </strong>{' '}
            profile. Adjust your defaults below.
          </p>
        </div>

        <div className="space-y-6">
          {/* Oil usage */}
          <FormField
            control={form.control}
            name="oilUsage"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  How much oil/fat when stir-frying?
                </FormLabel>
                <FormControl>
                  <div className="flex rounded-xl bg-[#F5F4F0] p-1">
                    {[
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'heavy', label: 'Heavy' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.onChange(opt.value);
                          reportChange();
                        }}
                        className={`flex-1 rounded-lg py-2 font-medium text-[13px] transition-all ${
                          field.value === opt.value
                            ? 'bg-white text-[#2C2416] shadow-sm'
                            : 'text-[#8B8682] hover:text-[#2C2416]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Rice per meal */}
          <FormField
            control={form.control}
            name="defaultRicePortion"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  Rice per meal
                </FormLabel>
                <FormControl>
                  <div className="flex rounded-xl bg-[#F5F4F0] p-1">
                    {[
                      {
                        value: 'small',
                        label: 'Minimal',
                        hint: '~150g',
                      },
                      {
                        value: 'medium',
                        label: 'Normal',
                        hint: '~200g',
                      },
                      {
                        value: 'large',
                        label: 'Heavy',
                        hint: '~300g',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.onChange(opt.value);
                          reportChange();
                        }}
                        className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-all ${
                          field.value === opt.value
                            ? 'bg-white text-[#2C2416] shadow-sm'
                            : 'text-[#8B8682] hover:text-[#2C2416]'
                        }`}
                      >
                        <span className="font-medium text-[13px]">
                          {opt.label}
                        </span>
                        <span className="mt-0.5 font-mono text-[10px] opacity-70">
                          {opt.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Fat trim */}
          <FormField
            control={form.control}
            name="fatTrim"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  Fat trimming habit
                </FormLabel>
                <FormControl>
                  <div className="flex rounded-xl bg-[#F5F4F0] p-1">
                    {[
                      { value: 'trim', label: 'Trim all' },
                      {
                        value: 'by_dish',
                        label: 'By dish',
                      },
                      {
                        value: 'eat_all',
                        label: 'Eat all',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.onChange(opt.value);
                          reportChange();
                        }}
                        className={`flex-1 rounded-lg py-2 font-medium text-[13px] transition-all ${
                          field.value === opt.value
                            ? 'bg-white text-[#2C2416] shadow-sm'
                            : 'text-[#8B8682] hover:text-[#2C2416]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Sugar in braised */}
          <FormField
            control={form.control}
            name="sugarBraised"
            render={({ field }) => (
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  Sugar in braised dishes
                </FormLabel>
                <FormControl>
                  <div className="flex rounded-xl bg-[#F5F4F0] p-1">
                    {[
                      { value: 'low', label: 'Low' },
                      {
                        value: 'medium',
                        label: 'Medium',
                      },
                      { value: 'high', label: 'High' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.onChange(opt.value);
                          reportChange();
                        }}
                        className={`flex-1 rounded-lg py-2 font-medium text-[13px] transition-all ${
                          field.value === opt.value
                            ? 'bg-white text-[#2C2416] shadow-sm'
                            : 'text-[#8B8682] hover:text-[#2C2416]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Checkbox items */}
          <div className="space-y-3">
            <FormField
              control={form.control}
              name="boneAwareness"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#EAE7E0] bg-white p-4 transition-colors hover:border-[#C9A87C]/50">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      reportChange();
                    }}
                    className="mt-1 h-4 w-4 rounded border-[#EAE7E0] bg-[#F5F4F0] text-[#2C2416] focus:ring-[#C9A87C]"
                  />
                  <div>
                    <div className="font-medium text-[#2C2416] text-[14px]">
                      Bone awareness
                    </div>
                    <div className="mt-0.5 text-[#8B8682] text-[12px]">
                      Automatically deduct bone weight from raw meat inputs
                      (e.g., ribs, chicken wings).
                    </div>
                  </div>
                </label>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
