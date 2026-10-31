'use client';

import { useLiveTargets } from '@/hooks/profile/use-live-targets';
import { CarbSplitSwitch } from './carb-split-switch';
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

  // Everything that moves the target (body, goal, pace) in one column on the
  // left, the target card on the right, so neither side leaves a hole.
  // Narrow (phones), everything stacks with the target first.
  return (
    <div className="@container">
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_18rem] @3xl:items-start gap-8">
        {live.tdee !== null && live.macros && (
          <div className="@3xl:order-last">
            <TargetHero
              tdee={live.tdee}
              targetCalories={live.targetCalories}
              macros={live.macros}
              savedCalorieTarget={savedCalorieTarget}
              goal={live.goal}
              aggression={live.aggression}
            >
              <CarbSplitSwitch />
            </TargetHero>
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-8">
          <MetricsFields />
          <GoalFields tdee={live.tdee} goal={live.goal} />
        </div>
      </div>
    </div>
  );
}
