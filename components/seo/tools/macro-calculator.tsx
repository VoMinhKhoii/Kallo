'use client';

import { useState } from 'react';
import { calcMacroGrams } from '@/lib/domain/onboarding/tdee';
import type { CarbSplit } from '@/lib/domain/onboarding/types';
import { valid } from '@/lib/seo/tools/math';
import type { ToolUi } from '@/lib/seo/tools/types';
import { ChoiceField, NumberField } from './fields';
import { NoResult, Result } from './result';

const SPLITS: CarbSplit[] = ['moderate_carb', 'lower_carb', 'higher_carb'];

export function MacroCalculator({
  ui,
  initialKcal,
  format,
}: {
  ui: ToolUi;
  initialKcal: number;
  format: (n: number) => string;
}) {
  const [kcal, setKcal] = useState<number | undefined>(initialKcal);
  const [split, setSplit] = useState<CarbSplit>('moderate_carb');
  const target = valid(kcal, 'kcal');
  const macros = target === null ? null : calcMacroGrams(target, split);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4">
        <NumberField
          integer
          label={ui.calories}
          onChange={setKcal}
          unit="kcal"
          value={kcal}
        />
        <ChoiceField
          label={ui.split}
          onChange={setSplit}
          options={SPLITS.map((s) => ({ value: s, label: ui.splits[s].label }))}
          value={split}
        />
      </div>
      {macros === null ? (
        <NoResult text={ui.fillIn} />
      ) : (
        <Result
          hint={ui.splits[split].desc}
          label={ui.protein}
          rows={[
            { label: ui.carbs, value: `${format(macros.carbsG)} g` },
            { label: ui.fat, value: `${format(macros.fatG)} g` },
          ]}
          unit={ui.gramsPerDay}
          value={format(macros.proteinG)}
        />
      )}
    </div>
  );
}
