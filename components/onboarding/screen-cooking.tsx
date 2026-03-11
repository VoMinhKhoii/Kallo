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
  defaultRicePortion: 'medium',
  sugarBraised: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
};

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
    <div className="flex rounded-xl bg-[#F5F4F0] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-1 flex-col items-center rounded-lg py-2 transition-all ${
            value === opt.value
              ? 'bg-white text-[#2C2416] shadow-sm'
              : 'text-[#8B8682] hover:text-[#2C2416]'
          }`}
        >
          <span className="font-medium text-[13px]">{opt.label}</span>
          {opt.hint && (
            <span className="mt-0.5 text-center text-[10px] leading-tight opacity-70">
              {opt.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ScreenCooking({
  defaultValues,
  regionalProfile,
  onChange,
}: ScreenCookingProps) {
  const hasPrePopulated = useRef(false);

  const initialDefaults = (() => {
    if (!allCookingFieldsNull(defaultValues)) {
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
                    mien_bac: 'Northern',
                    mien_trung: 'Central',
                    mien_nam: 'Southern',
                    mien_tay: 'Mekong Delta',
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
                  How would you describe your typical cooked dishes?
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'minimal',
                        label: 'Light',
                        hint: 'Dry, clean taste. Dish looks matte.',
                      },
                      {
                        value: 'normal',
                        label: 'Moderate',
                        hint: 'Light coating. Slight sheen on food.',
                      },
                      {
                        value: 'heavy',
                        label: 'Rich',
                        hint: 'Visibly oily. Sauce pools slightly.',
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
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  How much rice per meal?
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'small',
                        label: 'Light',
                        hint: '~1 small bowl',
                      },
                      {
                        value: 'medium',
                        label: 'Normal',
                        hint: '~1–1.5 bowls',
                      },
                      {
                        value: 'large',
                        label: 'Heavy',
                        hint: '~2+ bowls',
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
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  Sugar in braised dishes
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
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
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  How much protein (meat, fish, eggs) per meal?
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'small',
                        label: 'Small',
                        hint: 'Smaller than your palm, e.g. ~2-3 eggs',
                      },
                      {
                        value: 'medium',
                        label: 'Medium',
                        hint: 'About palm-sized',
                      },
                      {
                        value: 'large',
                        label: 'Large',
                        hint: 'Bigger than your palm, e.g. a chicken thigh or more',
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
              <FormItem className="rounded-2xl border border-[#EAE7E0] bg-white p-5">
                <FormLabel className="mb-3 block font-bold text-[#2C2416] text-[13px]">
                  When there&rsquo;s soup, how much broth do you usually drink?
                </FormLabel>
                <FormControl>
                  <OptionStrip
                    options={[
                      {
                        value: 'leave_it',
                        label: 'Leave it',
                        hint: 'Eat the solids, skip most broth',
                      },
                      {
                        value: 'some',
                        label: 'Some',
                        hint: 'Drink about half the bowl',
                      },
                      {
                        value: 'finish_it',
                        label: 'Finish it',
                        hint: 'Drink all or most of the broth',
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
