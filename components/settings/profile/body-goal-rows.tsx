'use client';

import { useTranslations } from 'next-intl';
import { useLiveTargets } from '@/hooks/profile/use-live-targets';
import { MetricsFields } from './metrics-fields';
import { PlanControls } from './plan-controls';
import { TargetHero } from './target-hero';

/**
 * The Body & goal page: the plan card (the live daily target and the goal,
 * pace and carb split that move it), then the body metrics under it.
 * Renders under the profile form's provider (useLiveTargets reads it with
 * useWatch), and saves through the dialog's shared save bar.
 */
export function BodyGoalRows({
  savedCalorieTarget,
}: {
  savedCalorieTarget: number | null;
}) {
  const t = useTranslations('settings.targetRitual');
  const live = useLiveTargets();

  // The plan card first (the target, its macros and the controls that move
  // it), then the body metrics it is computed from, as rows.
  return (
    <div className="@container flex flex-col gap-8">
      {live.tdee !== null && live.macros && (
        <section>
          <h3 className="mb-3 font-medium text-[15px] text-kallo-text">
            {t('heading')}
          </h3>
          <TargetHero
            tdee={live.tdee}
            targetCalories={live.targetCalories}
            macros={live.macros}
            savedCalorieTarget={savedCalorieTarget}
            goal={live.goal}
            aggression={live.aggression}
          >
            <PlanControls />
          </TargetHero>
        </section>
      )}
      <MetricsFields />
    </div>
  );
}
