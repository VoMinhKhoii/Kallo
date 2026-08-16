'use client';

import { useTranslations } from 'next-intl';
import type { calcMacroGrams } from '@/lib/onboarding/tdee';

const AGGRESSIVE_PACE_KG = 0.6;

interface TargetHeroProps {
  tdee: number;
  targetCalories: number;
  macros: ReturnType<typeof calcMacroGrams>;
  savedCalorieTarget: number | null;
  goal: string;
  aggression: number | null;
}

/**
 * The daily-target ritual — the group's last stacked row wrapping a
 * sub-surface. Daily target is the headline; TDEE is the supporting caption.
 * When the recomputed target diverges from the saved one, surface the
 * comparison (muted strikethrough → new), tinting terracotta on aggressive pace.
 */
export function TargetHero({
  tdee,
  targetCalories,
  macros,
  savedCalorieTarget,
  goal,
  aggression,
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

  return (
    <div className="p-card-sm">
      <div className="rounded-xl border border-kallo-accent/40 bg-kallo-surface p-card text-center">
        <span className="block font-bold text-[11px] text-kallo-text-soft uppercase tracking-widest">
          {diverged ? tSettings('targetRitual.newLabel') : t('calorieTarget')}
        </span>
        {diverged && savedCalorieTarget !== null ? (
          <p className="mt-1 font-serif text-[#9A8F80] text-sm tabular-nums line-through">
            {Math.round(savedCalorieTarget).toLocaleString()}{' '}
            {tSettings('targetRitual.unit')}
          </p>
        ) : null}
        <div
          className={`mt-1 font-serif text-4xl tabular-nums tracking-tighter sm:text-5xl ${newTargetClass}`}
          style={{ fontWeight: 400 }}
        >
          {newTarget.toLocaleString()}{' '}
          <span className="font-sans text-kallo-text-muted text-lg">
            {t('kcal')}
          </span>
        </div>
        {aggressivePace ? (
          <p className="mt-1.5 text-[12px] text-kallo-danger">
            {tSettings('targetRitual.aggressivePace', {
              pace: (aggression ?? 0).toFixed(2),
            })}
          </p>
        ) : null}
        <p className="mt-1.5 text-[12px] text-kallo-text-muted">
          {t('basedOnTdee')} ~{Math.round(tdee).toLocaleString()} {t('kcal')}
          {goal === 'maintaining' ? (
            <> · {t('maintenance')}</>
          ) : (
            <>
              {' · '}
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
        <div className="mt-5 grid grid-cols-3 gap-4 border-kallo-accent/20 border-t pt-4">
          <div>
            <div className="font-bold text-[10px] text-kallo-text-soft uppercase tracking-widest">
              {t('protein')}
            </div>
            <div className="font-medium text-kallo-text text-lg">
              {macros.proteinG}g
            </div>
          </div>
          <div>
            <div className="font-bold text-[10px] text-kallo-text-soft uppercase tracking-widest">
              {t('carbs')}
            </div>
            <div className="font-medium text-kallo-text text-lg">
              {macros.carbsG}g
            </div>
          </div>
          <div>
            <div className="font-bold text-[10px] text-kallo-text-soft uppercase tracking-widest">
              {t('fat')}
            </div>
            <div className="font-medium text-kallo-text text-lg">
              {macros.fatG}g
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
