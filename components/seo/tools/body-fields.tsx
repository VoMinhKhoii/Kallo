'use client';

import { useState } from 'react';
import type {
  ActivityLevel,
  BiologicalSex,
  BodyMetrics,
} from '@/lib/domain/onboarding/types';
import { ftInToCm, kgToLb, lbToKg } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { ChoiceField, NumberField, SelectField } from './fields';

/**
 * The body every calorie calculator starts from: sex, age, weight, height and
 * (when asked) activity. State is metric; the imperial view converts on the
 * way in and out, so the maths never sees pounds.
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

const round1 = (n: number) => Math.round(n * 10) / 10;

export function useBody(initial: BodyState) {
  const [body, setBody] = useState(initial);
  const [units, setUnits] = useState<Units>('metric');
  const metrics: BodyMetrics | null =
    body.age && body.weightKg && body.heightCm
      ? {
          biologicalSex: body.sex,
          age: body.age,
          weightKg: body.weightKg,
          heightCm: body.heightCm,
          activityLevel: body.activity,
        }
      : null;
  return { body, setBody, units, setUnits, metrics };
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
  const { body, setBody, units, setUnits } = state;
  const set = (patch: Partial<BodyState>) => setBody({ ...body, ...patch });
  const imperial = allowImperial && units === 'imperial';
  const totalIn = body.heightCm ? body.heightCm / 2.54 : undefined;
  const ft = totalIn === undefined ? undefined : Math.floor(totalIn / 12);
  const inches =
    totalIn === undefined ? undefined : Math.round(totalIn - (ft ?? 0) * 12);

  return (
    <div className="grid grid-cols-2 gap-4">
      {allowImperial ? (
        <ChoiceField
          className="col-span-2"
          label={ui.units}
          onChange={setUnits}
          options={[
            { value: 'metric', label: ui.metric },
            { value: 'imperial', label: ui.imperial },
          ]}
          value={units}
        />
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
      <NumberField
        label={ui.weight}
        onChange={(w) =>
          set({ weightKg: w === undefined ? w : imperial ? lbToKg(w) : w })
        }
        unit={imperial ? 'lb' : 'kg'}
        value={
          body.weightKg === undefined
            ? undefined
            : imperial
              ? round1(kgToLb(body.weightKg))
              : body.weightKg
        }
      />
      {imperial ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            integer
            label={ui.height}
            onChange={(f) =>
              set({ heightCm: f === undefined ? f : ftInToCm(f, inches ?? 0) })
            }
            unit="ft"
            value={ft}
          />
          <NumberField
            integer
            label={ui.height}
            onChange={(i) =>
              set({ heightCm: ftInToCm(ft ?? 0, i ?? 0) || undefined })
            }
            unit="in"
            value={inches}
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
