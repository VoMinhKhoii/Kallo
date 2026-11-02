'use client';

import {
  calcBMR,
  calcDailyTargets,
  calcTDEE,
} from '@/lib/domain/onboarding/tdee';
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
  format: (n: number) => string;
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
              value: `${format(
                calcDailyTargets(
                  tdee,
                  'cutting',
                  0.5,
                  'moderate_carb',
                  metrics.biologicalSex
                ).calories
              )} kcal`,
            },
            {
              label: ui.gainQuarter,
              value: `${format(
                calcDailyTargets(
                  tdee,
                  'bulking',
                  0.25,
                  'moderate_carb',
                  metrics.biologicalSex
                ).calories
              )} kcal`,
            },
          ]}
          unit={ui.kcalPerDay}
          value={format(tdee)}
        />
      )}
    </div>
  );
}
