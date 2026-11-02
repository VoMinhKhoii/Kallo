'use client';

import { useState } from 'react';
import type {
  ActivityLevel,
  BiologicalSex,
  BodyMetrics,
} from '@/lib/domain/onboarding/types';
import { ftInToCm, valid } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import {
  ChoiceField,
  NumberField,
  SelectField,
  UnitsField,
  WeightField,
} from './fields';

/**
 * The body every calorie calculator starts from: sex, age, weight, height and
 * (when asked) activity. State is metric; the imperial view converts on the
 * way in and out, so the maths never sees pounds. Feet and inches are kept as
 * typed while that view is open, so clearing one field never rewrites the
 * other.
 */
export interface BodyState {
  sex: BiologicalSex;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  activity: ActivityLevel;
}

export type Units = 'metric' | 'imperial';

const ACTIVITY: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very_active',
];

interface FtIn {
  ft?: number;
  inch?: number;
}

/** A height in cm as whole feet and inches (never "5 ft 12 in"). */
function toFtIn(cm: number | undefined): FtIn {
  if (cm === undefined) return {};
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

export function useBody(initial: BodyState) {
  const [body, setBody] = useState(initial);
  const [units, setUnitsState] = useState<Units>('metric');
  const [ftIn, setFtIn] = useState<FtIn>({});
  const setUnits = (next: Units) => {
    if (next === 'imperial' && units !== 'imperial')
      setFtIn(toFtIn(body.heightCm));
    setUnitsState(next);
  };
  const age = valid(body.age, 'age');
  const weightKg = valid(body.weightKg, 'weightKg');
  const heightCm = valid(body.heightCm, 'heightCm');
  const metrics: BodyMetrics | null =
    age !== null && weightKg !== null && heightCm !== null
      ? {
          biologicalSex: body.sex,
          age,
          weightKg,
          heightCm,
          activityLevel: body.activity,
        }
      : null;
  return { body, setBody, units, setUnits, ftIn, setFtIn, metrics };
}

export function BodyFields({
  ui,
  state,
  allowImperial,
  withSex = true,
  withAge = true,
  withActivity = true,
}: {
  ui: ToolUi;
  state: ReturnType<typeof useBody>;
  allowImperial: boolean;
  withSex?: boolean;
  withAge?: boolean;
  withActivity?: boolean;
}) {
  const { body, setBody, units, setUnits, ftIn, setFtIn } = state;
  const set = (patch: Partial<BodyState>) => setBody({ ...body, ...patch });
  const imperial = allowImperial && units === 'imperial';
  const setHeight = (next: FtIn) => {
    setFtIn(next);
    set({
      heightCm:
        next.ft === undefined ? undefined : ftInToCm(next.ft, next.inch ?? 0),
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {allowImperial ? (
        <UnitsField onChange={setUnits} ui={ui} value={units} />
      ) : null}
      {withSex ? (
        <ChoiceField
          className={withAge ? '' : 'col-span-2'}
          label={ui.sex}
          onChange={(sex) => set({ sex })}
          options={[
            { value: 'female', label: ui.female },
            { value: 'male', label: ui.male },
          ]}
          value={body.sex}
        />
      ) : null}
      {withAge ? (
        <NumberField
          integer
          label={ui.age}
          onChange={(age) => set({ age })}
          unit={ui.years}
          value={body.age}
        />
      ) : null}
      <WeightField
        imperial={imperial}
        kg={body.weightKg}
        label={ui.weight}
        onKg={(weightKg) => set({ weightKg })}
      />
      {imperial ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            integer
            label={ui.height}
            onChange={(ft) => setHeight({ ...ftIn, ft })}
            unit="ft"
            value={ftIn.ft}
          />
          <NumberField
            integer
            label={ui.height}
            onChange={(inch) => setHeight({ ...ftIn, inch })}
            unit="in"
            value={ftIn.inch}
          />
        </div>
      ) : (
        <NumberField
          label={ui.height}
          onChange={(heightCm) => set({ heightCm })}
          unit="cm"
          value={body.heightCm}
        />
      )}
      {withActivity ? (
        <SelectField
          className="col-span-2"
          label={ui.activity}
          onChange={(activity) => set({ activity })}
          options={ACTIVITY.map((a) => ({
            value: a,
            label: ui.activityLevels[a],
          }))}
          value={body.activity}
        />
      ) : null}
    </div>
  );
}
