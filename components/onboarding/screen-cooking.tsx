'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import {
  cookingHabitsSchema,
  type CookingHabitsInput,
} from '@/lib/onboarding/schemas';
import { REGIONAL_COOKING_DEFAULTS } from '@/lib/onboarding/constants';
import type {
  CookingHabits,
  RegionalProfile,
} from '@/lib/onboarding/types';

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

function allCookingFieldsNull(
  values: Partial<CookingHabits>,
): boolean {
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
      const defaults =
        REGIONAL_COOKING_DEFAULTS[regionalProfile];
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
          <h2 className="font-semibold text-lg">
            Thói quen nấu ăn
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            AI sẽ dùng thông tin này để ước lượng dinh dưỡng
            chính xác hơn
          </p>
        </div>

        <div className="space-y-6">
          {/* Oil Usage */}
          <FormField
            control={form.control}
            name="oilUsage"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <FormLabel className="text-sm font-medium">
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
                      <ToggleGroupItem value="minimal">
                        Ít dầu
                      </ToggleGroupItem>
                      <ToggleGroupItem value="normal">
                        Bình thường
                      </ToggleGroupItem>
                      <ToggleGroupItem value="heavy">
                        Nhiều dầu
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <FormLabel className="text-sm font-medium">
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
                      <ToggleGroupItem value="trim">
                        Bỏ mỡ
                      </ToggleGroupItem>
                      <ToggleGroupItem value="eat_all">
                        Ăn nguyên
                      </ToggleGroupItem>
                      <ToggleGroupItem value="by_dish">
                        Tùy món
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
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
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="bone-awareness"
                    className="text-sm font-medium"
                  >
                    Bạn có cân nhắc xương khi ước lượng
                    phần ăn?
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
              </FormItem>
            )}
          />

          {/* Default Rice Portion */}
          <FormField
            control={form.control}
            name="defaultRicePortion"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <FormLabel className="text-sm font-medium">
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
                      <ToggleGroupItem value="small">
                        Nhỏ ~150g
                      </ToggleGroupItem>
                      <ToggleGroupItem value="medium">
                        Vừa ~200g
                      </ToggleGroupItem>
                      <ToggleGroupItem value="large">
                        Lớn ~300g
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <FormLabel className="text-sm font-medium">
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
                      <ToggleGroupItem value="low">
                        Ít
                      </ToggleGroupItem>
                      <ToggleGroupItem value="medium">
                        Vừa
                      </ToggleGroupItem>
                      <ToggleGroupItem value="high">
                        Nhiều
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
