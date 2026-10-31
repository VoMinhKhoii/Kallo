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

  // The target is what every field here moves, so it stays in sight: a
  // sticky card beside the inputs when the page is wide enough, the first
  // card above them when it is not (phones, a narrow window).
  return (
    <div className="@container">
      <div className="grid @3xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:items-start gap-4">
        {live.tdee !== null && live.macros && (
          <div className="@3xl:sticky @3xl:top-14 @3xl:order-last">
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
        <div className="flex min-w-0 flex-col gap-4">
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
            </div>
          </SettingsGroup>
        </div>
      </div>
    </div>
  );
}
