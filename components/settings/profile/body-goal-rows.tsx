'use client';

import { SettingsGroup } from '@/components/settings/chrome/group';
import { useLiveTargets } from '@/hooks/profile/use-live-targets';
import { GoalFields } from './goal-fields';
import { MetricsFields } from './metrics-fields';
import { TargetHero } from './target-hero';

/**
 * The Body & goal page: body metrics, goal and the live daily target they
 * produce. Renders under the profile form's provider (useLiveTargets reads it
 * with useWatch), and saves through the dialog's shared save bar.
 */
export function BodyGoalRows({
  savedCalorieTarget,
}: {
  savedCalorieTarget: number | null;
}) {
  const live = useLiveTargets();

  // Two cards: what your body is, then what you want from it and the target
  // that follows.
  return (
    <div className="flex flex-col gap-4">
      <SettingsGroup>
        <MetricsFields />
      </SettingsGroup>
      <SettingsGroup>
        <div>
          <GoalFields
            tdee={live.tdee}
            targetCalories={live.targetCalories}
            goal={live.goal}
          />
          {live.tdee !== null && live.macros && (
            <TargetHero
              tdee={live.tdee}
              targetCalories={live.targetCalories}
              macros={live.macros}
              savedCalorieTarget={savedCalorieTarget}
              goal={live.goal}
              aggression={live.aggression}
            />
          )}
        </div>
      </SettingsGroup>
    </div>
  );
}
