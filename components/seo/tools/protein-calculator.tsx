'use client';

import { useState } from 'react';
import {
  kgToLb,
  lbToKg,
  type ProteinGoal,
  proteinRange,
} from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { ChoiceField, NumberField } from './fields';
import { NoResult, Result } from './result';

const GOALS: ProteinGoal[] = ['health', 'muscle', 'cut'];

export function ProteinCalculator({
  ui,
  initialWeightKg,
  allowImperial,
  format,
}: {
  ui: ToolUi;
  initialWeightKg: number;
  allowImperial: boolean;
  format: (n: number, digits?: number) => string;
}) {
  const [weight, setWeight] = useState<number | undefined>(initialWeightKg);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [goal, setGoal] = useState<ProteinGoal>('muscle');
  const [bodyFat, setBodyFat] = useState<number | undefined>(undefined);
  const imperial = allowImperial && units === 'imperial';
  const weightKg =
    weight === undefined ? undefined : imperial ? lbToKg(weight) : weight;
  const range = weightKg
    ? proteinRange({ weightKg, goal, bodyFatPct: bodyFat })
    : null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {allowImperial ? (
          <ChoiceField
            className="col-span-2"
            label={ui.units}
            onChange={(u) => {
              if (weight !== undefined && u !== units)
                setWeight(
                  Math.round(
                    (u === 'imperial' ? kgToLb(weight) : lbToKg(weight)) * 10
                  ) / 10
                );
              setUnits(u);
            }}
            options={[
              { value: 'metric', label: ui.metric },
              { value: 'imperial', label: ui.imperial },
            ]}
            value={units}
          />
        ) : null}
        <ChoiceField
          className="col-span-2"
          label={ui.goal}
          onChange={setGoal}
          options={GOALS.map((g) => ({ value: g, label: ui.proteinGoals[g] }))}
          value={goal}
        />
        <NumberField
          label={ui.weight}
          onChange={setWeight}
          unit={imperial ? 'lb' : 'kg'}
          value={weight}
        />
        {goal === 'cut' ? (
          <NumberField
            label={ui.bodyFat}
            onChange={setBodyFat}
            unit={`%, ${ui.optional}`}
            value={bodyFat}
          />
        ) : null}
      </div>
      {range === null ? (
        <NoResult text={ui.fillIn} />
      ) : (
        <Result
          hint={
            range.lowPerKg === range.highPerKg
              ? `${format(range.lowPerKg, 1)} ${ui.perKgBody}`
              : `${format(range.lowPerKg, 1)}–${format(range.highPerKg, 1)} ${
                  range.basis === 'lean' ? ui.perKgLean : ui.perKgBody
                }`
          }
          label={ui.protein}
          unit={ui.gramsPerDay}
          value={
            range.lowG === range.highG
              ? format(range.lowG)
              : `${format(range.lowG)}–${format(range.highG)}`
          }
        />
      )}
    </div>
  );
}
