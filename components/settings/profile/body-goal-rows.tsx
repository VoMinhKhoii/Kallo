'use client';

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

  // Body inputs on the left with the target they produce on the right; the
  // goal, which moves the target too, spans the full width right under both.
  // Narrow (phones), everything stacks with the target first.
  return (
    <div className="@container flex flex-col gap-8">
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:items-start gap-8">
        {live.tdee !== null && live.macros && (
          <div className="@3xl:order-last">
            <TargetHero
              tdee={live.tdee}
              targetCalories={live.targetCalories}
              macros={live.macros}
              savedCalorieTarget={savedCalorieTarget}
              goal={live.goal}
              aggression={live.aggression}
            />
          </div>
        )}
        <MetricsFields />
      </div>
      <GoalFields tdee={live.tdee} goal={live.goal} />
    </div>
  );
}
