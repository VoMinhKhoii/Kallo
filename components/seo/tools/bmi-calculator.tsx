'use client';

import {
  bmi,
  bmiBand,
  kgToLb,
  normalWeightRange,
  valid,
} from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { BodyFields, type BodyState, useBody } from './body-fields';
import { NoResult, Result } from './result';

export function BmiCalculator({
  ui,
  initial,
  allowImperial,
  asiaFirst,
  format,
}: {
  ui: ToolUi;
  initial: BodyState;
  allowImperial: boolean;
  /** Vietnamese readers come for the Asian bands; show those first there. */
  asiaFirst: boolean;
  format: (n: number, digits?: number) => string;
}) {
  const state = useBody(initial);
  const weightKg = valid(state.body.weightKg, 'weightKg');
  const heightCm = valid(state.body.heightCm, 'heightCm');
  const value =
    weightKg !== null && heightCm !== null ? bmi(weightKg, heightCm) : null;
  const lb = allowImperial && state.units === 'imperial';
  const weight = (kg: number) =>
    lb ? `${format(kgToLb(kg))} lb` : `${format(kg, 1)} kg`;
  const standards = (
    asiaFirst ? (['asia', 'who'] as const) : (['who', 'asia'] as const)
  ).map((s) => ({
    s,
    name: s === 'who' ? ui.standardWho : ui.standardAsia,
  }));

  return (
    <div>
      <BodyFields
        allowImperial={allowImperial}
        state={state}
        ui={ui}
        withActivity={false}
        withAge={false}
        withSex={false}
      />
      {value === null || !heightCm ? (
        <NoResult text={ui.fillIn} />
      ) : (
        <Result
          label={ui.bmi}
          rows={standards.flatMap(({ s, name }) => {
            const [lo, hi] = normalWeightRange(heightCm, s);
            return [
              { label: name, value: ui.bands[bmiBand(value, s)] },
              {
                label: `${ui.normalRange} (${name})`,
                value: `${weight(lo)}–${weight(hi)}`,
              },
            ];
          })}
          value={format(value, 1)}
        />
      )}
    </div>
  );
}
