'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { calcMacroGrams } from '@/lib/domain/onboarding/tdee';

const AGGRESSIVE_PACE_KG = 0.6;

interface TargetHeroProps {
  tdee: number;
  targetCalories: number;
  macros: ReturnType<typeof calcMacroGrams>;
  savedCalorieTarget: number | null;
  goal: string;
  aggression: number | null;
  /** The controls that move the target (goal, pace, carb split). */
  children: ReactNode;
}

/**
 * The daily plan, as one card: the result on the left (the kcal target with
 * its macros right under it, then the TDEE it rests on) and the controls that
 * move it on the right, so a change shows up beside the control that made
 * it. Stacked on a phone. When the recomputed target differs from the saved
 * one, a line under it names the saved target it would replace; an aggressive
 * pace tints the number terracotta.
 */
export function TargetHero({
  tdee,
  targetCalories,
  macros,
  savedCalorieTarget,
  goal,
  aggression,
  children,
}: TargetHeroProps) {
  const t = useTranslations('onboarding.bodyMetrics');
  const tSettings = useTranslations('settings');

  const newTarget = Math.round(Math.max(targetCalories, 500));
  const diverged =
    savedCalorieTarget !== null && Math.round(savedCalorieTarget) !== newTarget;
  const aggressivePace =
    goal !== 'maintaining' && (aggression ?? 0) > AGGRESSIVE_PACE_KG;
  const newTargetClass = aggressivePace
    ? 'text-kallo-danger'
    : 'text-kallo-text';

  const macroRows = [
    { label: t('protein'), grams: macros.proteinG },
    { label: t('carbs'), grams: macros.carbsG },
    { label: t('fat'), grams: macros.fatG },
  ];

  return (
    <div className="grid @3xl:grid-cols-[15rem_minmax(0,1fr)] @3xl:gap-x-8 rounded-2xl border border-kallo-border bg-card p-5">
      <div>
        <p
          className={`font-semibold text-[40px] tabular-nums leading-none tracking-tight ${newTargetClass}`}
        >
          {newTarget.toLocaleString()}{' '}
          <span className="font-normal text-[15px] text-kallo-text-muted tracking-normal">
            {t('kcal')}
          </span>
        </p>
        {diverged && savedCalorieTarget !== null ? (
          <p className="mt-2 text-[13px] text-kallo-text-muted tabular-nums">
            {tSettings('targetRitual.replaces', {
              kcal: Math.round(savedCalorieTarget).toLocaleString(),
            })}
          </p>
        ) : null}
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {macroRows.map((row) => (
            <div key={row.label}>
              <dt className="text-[13px] text-kallo-text-muted">{row.label}</dt>
              <dd className="mt-0.5 font-medium text-[15px] text-kallo-text tabular-nums">
                {row.grams} {t('grams')}
              </dd>
            </div>
          ))}
        </dl>
        {aggressivePace ? (
          <p className="mt-4 text-[13px] text-kallo-danger">
            {tSettings('targetRitual.aggressivePace', {
              pace: (aggression ?? 0).toFixed(2),
            })}
          </p>
        ) : null}
        {/* The deficit or surplus itself reads on the pace row. */}
        <p className="mt-4 text-[13px] text-kallo-text-muted">
          {t('basedOnTdee')} ~{Math.round(tdee).toLocaleString()} {t('kcal')}
          {goal === 'maintaining' && (
            <>
              <br />
              {t('maintenance')}
            </>
          )}
        </p>
      </div>
      <div className="@3xl:mt-0 mt-5 divide-y divide-kallo-border border-kallo-border border-t @3xl:border-t-0 @3xl:border-l @3xl:pt-0 pt-1 @3xl:pl-8">
        {children}
      </div>
    </div>
  );
}
