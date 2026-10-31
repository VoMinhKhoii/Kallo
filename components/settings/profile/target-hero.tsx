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
  /** Sits between how the number was reached and the macros (the carb split). */
  children?: ReactNode;
}

/**
 * The daily target, as a card beside (or above) the body inputs that produce
 * it: the number, how it was reached, the carb split and the macros it
 * splits into. When the
 * recomputed target differs from the saved one, the saved one shows struck
 * through under it; an aggressive pace tints the number terracotta.
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
    <div className="rounded-2xl border border-kallo-border bg-card p-5">
      <p className="text-[13px] text-kallo-text-muted">
        {diverged ? tSettings('targetRitual.newLabel') : t('calorieTarget')}
      </p>
      <p
        className={`mt-2 font-semibold text-[40px] tabular-nums leading-none tracking-tight ${newTargetClass}`}
      >
        {newTarget.toLocaleString()}{' '}
        <span className="font-normal text-[15px] text-kallo-text-muted tracking-normal">
          {t('kcal')}
        </span>
      </p>
      {diverged && savedCalorieTarget !== null ? (
        <p className="mt-2 text-[13px] text-kallo-text-muted tabular-nums line-through">
          {Math.round(savedCalorieTarget).toLocaleString()}{' '}
          {tSettings('targetRitual.unit')}
        </p>
      ) : null}
      {aggressivePace ? (
        <p className="mt-2 text-[13px] text-kallo-danger">
          {tSettings('targetRitual.aggressivePace', {
            pace: (aggression ?? 0).toFixed(2),
          })}
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-kallo-text-muted">
        {t('basedOnTdee')} ~{Math.round(tdee).toLocaleString()} {t('kcal')}
        <br />
        {goal === 'maintaining' ? (
          t('maintenance')
        ) : (
          <>
            {goal === 'cutting' ? '−' : '+'}
            {Math.abs(
              Math.round(tdee) - Math.round(targetCalories)
            ).toLocaleString()}{' '}
            {t('perDay')}{' '}
            {goal === 'cutting'
              ? t('aggressionDeficit')
              : t('aggressionSurplus')}
          </>
        )}
      </p>
      {children && <div className="mt-5">{children}</div>}
      <dl className="mt-4 divide-y divide-kallo-border border-kallo-border border-t">
        {macroRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2.5 text-[14px]"
          >
            <dt className="text-kallo-text-muted">{row.label}</dt>
            <dd className="font-medium text-kallo-text tabular-nums">
              {row.grams} {t('grams')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
