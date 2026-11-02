'use client';

import { useState } from 'react';
import { CALORIE_FLOOR_KCAL } from '@/lib/domain/onboarding/constants';
import { calcBMR, calcTDEE } from '@/lib/domain/onboarding/tdee';
import { goalPlan, kgToLb, lbToKg } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { BodyFields, type BodyState, useBody } from './body-fields';
import { ChoiceField, NumberField } from './fields';
import { NoResult, Result } from './result';

const PACES = ['0.25', '0.5', '0.75'] as const;

export function DeficitCalculator({
  ui,
  initial,
  initialGoalKg,
  allowImperial,
  format,
  formatDate,
}: {
  ui: ToolUi;
  initial: BodyState;
  initialGoalKg: number;
  allowImperial: boolean;
  format: (n: number, digits?: number) => string;
  formatDate: (d: Date) => string;
}) {
  const state = useBody(initial);
  const { metrics, body, units } = state;
  const [goalKg, setGoalKg] = useState<number | undefined>(initialGoalKg);
  const [pace, setPace] = useState<(typeof PACES)[number]>('0.5');
  const [now] = useState(() => Date.now());
  const imperial = allowImperial && units === 'imperial';

  const tdee = metrics ? calcTDEE(calcBMR(metrics), body.activity) : null;
  const plan =
    tdee !== null && metrics && goalKg
      ? goalPlan({
          tdee,
          sex: metrics.biologicalSex,
          weightKg: metrics.weightKg,
          goalKg,
          paceKgPerWeek: Number(pace),
        })
      : null;
  const reach =
    plan?.weeks != null
      ? formatDate(new Date(now + plan.weeks * 7 * 86_400_000))
      : null;

  return (
    <div>
      <BodyFields allowImperial={allowImperial} state={state} ui={ui} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <NumberField
          label={ui.goalWeight}
          onChange={(w) =>
            setGoalKg(w === undefined ? w : imperial ? lbToKg(w) : w)
          }
          unit={imperial ? 'lb' : 'kg'}
          value={
            goalKg === undefined
              ? undefined
              : imperial
                ? Math.round(kgToLb(goalKg) * 10) / 10
                : goalKg
          }
        />
        <ChoiceField
          label={`${ui.pace} (kg ${ui.perWeek})`}
          onChange={setPace}
          options={PACES.map((p) => ({
            value: p,
            label: format(Number(p), 2),
          }))}
          value={pace}
        />
      </div>
      {plan === null || tdee === null || !metrics ? (
        <NoResult text={ui.fillIn} />
      ) : (
        <Result
          label={ui.dailyTarget}
          note={
            plan.weeks === null
              ? ui.sameWeight
              : plan.floored
                ? ui.floored
                    .replace(
                      '{floor}',
                      format(
                        Math.min(
                          tdee,
                          CALORIE_FLOOR_KCAL[metrics.biologicalSex]
                        )
                      )
                    )
                    .replace('{pace}', format(plan.paceKgPerWeek, 2))
                : undefined
          }
          rows={[
            { label: ui.tdee, value: `${format(tdee)} kcal` },
            ...(reach && plan.weeks !== null
              ? [
                  {
                    label: ui.reachBy,
                    value: `${reach} (${plan.weeks} ${ui.weeks})`,
                  },
                ]
              : []),
          ]}
          unit={ui.kcalPerDay}
          value={format(plan.targetKcal)}
        />
      )}
    </div>
  );
}
