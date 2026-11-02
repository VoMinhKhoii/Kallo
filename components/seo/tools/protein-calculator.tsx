'use client';

import { useState } from 'react';
import { type ProteinGoal, proteinRange, valid } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { ChoiceField, NumberField, UnitsField, WeightField } from './fields';
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
  // Weight is kept in kg whatever the view, like the other calculators, so a
  // unit switch never rounds an accepted weight out of range.
  const [kg, setKg] = useState<number | undefined>(initialWeightKg);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [goal, setGoal] = useState<ProteinGoal>('muscle');
  const [bodyFat, setBodyFat] = useState<number | undefined>(undefined);
  const imperial = allowImperial && units === 'imperial';
  const weightKg = valid(kg, 'weightKg');
  // Body fat is optional: empty means "not given", but a typed value outside
  // the limits withholds the result rather than quietly switching formulas.
  const fat = goal === 'cut' ? bodyFat : undefined;
  const fatPct = fat === undefined ? null : valid(fat, 'bodyFatPct');
  const range =
    weightKg === null || (fat !== undefined && fatPct === null)
      ? null
      : proteinRange({ weightKg, goal, bodyFatPct: fatPct });

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        {allowImperial ? (
          <UnitsField onChange={setUnits} ui={ui} value={units} />
        ) : null}
        <ChoiceField
          className="col-span-2"
          label={ui.goal}
          onChange={setGoal}
          options={GOALS.map((g) => ({ value: g, label: ui.proteinGoals[g] }))}
          value={goal}
        />
        <WeightField
          imperial={imperial}
          kg={kg}
          label={ui.weight}
          onKg={setKg}
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
