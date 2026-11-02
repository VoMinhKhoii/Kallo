'use client';

import { calcBMR, calcTDEE } from '@/lib/domain/onboarding/tdee';
import type { BodyMetrics } from '@/lib/domain/onboarding/types';
import { goalPlan } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { BodyFields, type BodyState, useBody } from './body-fields';
import { NoResult, Result } from './result';

export function TdeeCalculator({
  ui,
  initial,
  allowImperial,
  format,
}: {
  ui: ToolUi;
  initial: BodyState;
  allowImperial: boolean;
  format: (n: number, digits?: number) => string;
}) {
  const state = useBody(initial);
  const { metrics, body } = state;
  const bmr = metrics ? calcBMR(metrics) : null;
  const tdee = bmr === null ? null : calcTDEE(bmr, body.activity);

  return (
    <div>
      <BodyFields allowImperial={allowImperial} state={state} ui={ui} />
      {tdee === null || bmr === null || !metrics ? (
        <NoResult text={ui.fillIn} />
      ) : (
        <Result
          hint={ui.tdeeHint}
          label={ui.tdee}
          rows={[
            {
              label: `${ui.bmr} (${ui.bmrHint})`,
              value: `${format(Math.round(bmr))} kcal`,
            },
            {
              label: ui.loseHalf,
              value: paceRow(tdee, metrics, -1, 0.5, ui, format),
            },
            {
              label: ui.gainQuarter,
              value: paceRow(tdee, metrics, 1, 0.25, ui, format),
            },
          ]}
          unit={ui.kcalPerDay}
          value={format(tdee)}
        />
      )}
    </div>
  );
}

/**
 * A "to lose / gain X kg a week" row, through the deficit calculator's maths,
 * so a cut the floor slows shows the pace it really gives, never the asked one.
 */
function paceRow(
  tdee: number,
  metrics: BodyMetrics,
  direction: -1 | 1,
  pace: number,
  ui: ToolUi,
  format: (n: number, digits?: number) => string
): string {
  const plan = goalPlan({
    tdee,
    sex: metrics.biologicalSex,
    weightKg: metrics.weightKg,
    goalKg: metrics.weightKg + direction,
    paceKgPerWeek: pace,
  });
  const kcal = `${format(plan.targetKcal)} kcal`;
  if (plan.kind === 'unreachable') return `${kcal} (${ui.noLoss})`;
  if (plan.kind === 'floored')
    return `${kcal} (${format(plan.paceKgPerWeek, 2)} kg ${ui.perWeek})`;
  return kcal;
}
