'use client';

import { ArrowDown, ArrowUp, Equal, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { FieldSection } from '@/components/settings/chrome/field-section';
import { SettingsRow } from '@/components/settings/chrome/group';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
import { StepSlider } from '@/components/settings/chrome/step-slider';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { AGGRESSION_KCAL_PER_KG } from '@/lib/domain/onboarding/constants';
import type { Goal } from '@/lib/domain/onboarding/types';
import type { ProfileFormValues } from '@/lib/domain/settings/profile-form';

const GOALS: { value: Goal; icon: LucideIcon }[] = [
  { value: 'cutting', icon: ArrowDown },
  { value: 'maintaining', icon: Equal },
  { value: 'bulking', icon: ArrowUp },
];
const PACE_MIN_KG = 0.1;
const PACE_MAX_KG = 0.8;

interface GoalFieldsProps {
  /** Live TDEE; the goal and pace only render once metrics produce one. */
  tdee: number | null;
  goal: string;
}

export function GoalFields({ tdee, goal }: GoalFieldsProps) {
  const t = useTranslations('onboarding.bodyMetrics');
  const form = useFormContext<ProfileFormValues>();

  if (tdee === null) return null;

  return (
    <FieldSection title={t('goal')}>
      <FormField
        control={form.control}
        name="goal"
        render={({ field }) => (
          <FormItem className="py-2.5">
            <FormControl>
              <div>
                <OptionStrip
                  value={field.value ?? ''}
                  onChange={(g) => {
                    field.onChange(g);
                    if (g !== 'maintaining' && !form.getValues('aggression')) {
                      form.setValue('aggression', 0.5, { shouldDirty: true });
                    }
                  }}
                  options={GOALS.map((g) => ({
                    value: g.value,
                    label: t(g.value),
                    icon: g.icon,
                  }))}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />

      {goal !== 'maintaining' && (
        <FormField
          control={form.control}
          name="aggression"
          render={({ field }) => {
            const aggressionKg = field.value ?? 0.5;
            const kcalDelta = Math.round(aggressionKg * AGGRESSION_KCAL_PER_KG);
            const pace = `${aggressionKg.toFixed(2)} ${t('weightUnit')}/wk`;
            const delta = `${goal === 'cutting' ? '−' : '+'}${kcalDelta} ${t('perDay')}`;
            // The kcal it costs is in the target card; the row stays one line.
            return (
              <FormItem>
                <SettingsRow label={t('aggressionLabel')}>
                  <div className="flex @lg:w-80 w-full items-center gap-4">
                    <FormControl>
                      <StepSlider
                        min={PACE_MIN_KG}
                        max={PACE_MAX_KG}
                        step={0.05}
                        tickEvery={0.1}
                        value={aggressionKg}
                        onChange={field.onChange}
                        aria-label={t('aggressionLabel')}
                        aria-valuetext={`${pace}, ${delta}`}
                      />
                    </FormControl>
                    <span className="w-20 shrink-0 text-right text-[14px] text-kallo-text tabular-nums">
                      {pace}
                    </span>
                  </div>
                </SettingsRow>
              </FormItem>
            );
          }}
        />
      )}
    </FieldSection>
  );
}
