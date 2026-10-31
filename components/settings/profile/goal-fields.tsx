'use client';

import { ArrowDown, ArrowUp, Equal, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { FieldSection } from '@/components/settings/chrome/field-section';
import { SettingsRow } from '@/components/settings/chrome/group';
import { OptionStrip } from '@/components/settings/chrome/option-strip';
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
            const filled =
              ((aggressionKg - PACE_MIN_KG) / (PACE_MAX_KG - PACE_MIN_KG)) *
              100;
            const delta = `${goal === 'cutting' ? '−' : '+'}${kcalDelta} ${t('perDay')}`;
            // The kcal it costs is in the target card; the row stays one line.
            return (
              <FormItem>
                <SettingsRow label={t('aggressionLabel')}>
                  <div className="flex @lg:w-80 w-full items-center gap-4">
                    <FormControl>
                      <input
                        type="range"
                        min={PACE_MIN_KG}
                        max={PACE_MAX_KG}
                        step={0.05}
                        value={aggressionKg}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        aria-label={t('aggressionLabel')}
                        aria-valuetext={`${pace}, ${delta}`}
                        // Native for its keyboard and screen-reader support,
                        // drawn by hand: Chrome paints the unfilled track
                        // near-black beside a light accent colour.
                        style={{
                          background: `linear-gradient(to right, var(--kallo-accent) ${filled}%, var(--kallo-segment) ${filled}%)`,
                        }}
                        className="h-1 min-w-0 flex-1 appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-kallo-border [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-kallo-border [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
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
