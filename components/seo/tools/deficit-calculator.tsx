'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  calcBMR,
  calcCalorieFloor,
  calcTDEE,
} from '@/lib/domain/onboarding/tdee';
import { goalPlan, kgToLb, lbToKg, valid } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { BodyFields, type BodyState, useBody } from './body-fields';
import { ChoiceField, NumberField } from './fields';
import { NoResult, Result } from './result';

const PACES = ['0.25', '0.5', '0.75'] as const;

const DAY_MS = 86_400_000;
const noSubscribe = () => () => {};
/**
 * Today as a whole UTC day, read only in the browser. The page is prerendered
 * at build time, so a date computed on the server would be the build day and
 * would not match the browser's: the server renders the weeks only, and the
 * date appears after hydration.
 */
const useToday = () =>
  useSyncExternalStore(
    noSubscribe,
    () => Math.floor(Date.now() / DAY_MS),
    () => null
  );

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
  const today = useToday();
  const imperial = allowImperial && units === 'imperial';

  const tdee = metrics ? calcTDEE(calcBMR(metrics), body.activity) : null;
  const goal = valid(goalKg, 'weightKg');
  const plan =
    tdee !== null && metrics && goal !== null
      ? goalPlan({
          tdee,
          sex: metrics.biologicalSex,
          weightKg: metrics.weightKg,
          goalKg: goal,
          paceKgPerWeek: Number(pace),
        })
      : null;
  const reach =
    plan?.weeks != null && today !== null
      ? formatDate(new Date((today + plan.weeks * 7) * DAY_MS))
      : null;
  const sameWeight = metrics !== null && goal === metrics.weightKg;

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
            sameWeight
              ? ui.sameWeight
              : plan.weeks === null
                ? ui.unreachable.replace(
                    '{floor}',
                    format(calcCalorieFloor(metrics.biologicalSex, tdee))
                  )
                : plan.floored
                  ? ui.floored
                      .replace(
                        '{floor}',
                        format(calcCalorieFloor(metrics.biologicalSex, tdee))
                      )
                      .replace('{pace}', format(plan.paceKgPerWeek, 2))
                  : undefined
          }
          rows={[
            { label: ui.tdee, value: `${format(tdee)} kcal` },
            ...(plan.weeks !== null
              ? [
                  {
                    label: ui.reachBy,
                    value: reach
                      ? `${reach} (${plan.weeks} ${ui.weeks})`
                      : `${plan.weeks} ${ui.weeks}`,
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
