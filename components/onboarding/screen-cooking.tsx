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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
        form.setValue(key as keyof CookingHabitsInput, val);
      }
      hasPrePopulated.current = true;
    }
    // Report initial values upstream
    reportChange();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Form {...form}>
      <form className="space-y-8">
        <div>
          <h2
            className="font-semibold text-[#2C2416] text-lg"
            style={{ fontFamily: 'Lora, serif' }}
          >
            Thói quen nấu ăn
          </h2>
          <p
            className="mt-1.5 text-[#6B5D4F] text-sm"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            AI sẽ dùng thông tin này để ước lượng dinh dưỡng chính xác hơn
          </p>
        </div>

        <div className="space-y-4">
          {/* Oil Usage */}
          <FormField
            control={form.control}
            name="oilUsage"
            render={({ field }) => (
              <FormItem>
                <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Mức dầu mỡ khi nấu
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) {
                            field.onChange(v);
                            reportChange();
                          }
                        }}
                      >
                        <ToggleGroupItem
                          value="minimal"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Ít dầu
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="normal"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Bình thường
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="heavy"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Nhiều dầu
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Fat Trimming */}
          <FormField
            control={form.control}
            name="fatTrim"
            render={({ field }) => (
              <FormItem>
                <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Khi ăn thịt, bạn xử lý mỡ thế nào?
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) {
                            field.onChange(v);
                            reportChange();
                          }
                        }}
                      >
                        <ToggleGroupItem
                          value="trim"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Bỏ mỡ
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="eat_all"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Ăn nguyên
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="by_dish"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Tùy món
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Bone Awareness */}
          <FormField
            control={form.control}
            name="boneAwareness"
            render={({ field }) => (
              <FormItem>
                <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label
                      htmlFor="bone-awareness"
                      className="font-medium text-[#2C2416] text-sm"
                    >
                      Bạn có cân nhắc xương khi ước lượng phần ăn?
                    </Label>
                    <FormControl>
                      <Switch
                        id="bone-awareness"
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          reportChange();
                        }}
                      />
                    </FormControl>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Default Rice Portion */}
          <FormField
            control={form.control}
            name="defaultRicePortion"
            render={({ field }) => (
              <FormItem>
                <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Khẩu phần cơm mặc định
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) {
                            field.onChange(v);
                            reportChange();
                          }
                        }}
                      >
                        <ToggleGroupItem
                          value="small"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Nhỏ ~150g
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="medium"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Vừa ~200g
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="large"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Lớn ~300g
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </div>
              </FormItem>
            )}
          />

          {/* Sugar in Braised Dishes */}
          <FormField
            control={form.control}
            name="sugarBraised"
            render={({ field }) => (
              <FormItem>
                <div className="rounded-xl border border-[#E8D5B5]/50 bg-[#FEFBF6] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <FormLabel className="font-medium text-[#2C2416] text-sm">
                      Mức đường trong món kho?
                    </FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(v) => {
                          if (v) {
                            field.onChange(v);
                            reportChange();
                          }
                        }}
                      >
                        <ToggleGroupItem
                          value="low"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Ít
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="medium"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Vừa
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="high"
                          className="min-w-[72px] px-3 py-2"
                        >
                          Nhiều
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                  </div>
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
