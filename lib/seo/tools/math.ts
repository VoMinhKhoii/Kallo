import { AGGRESSION_KCAL_PER_KG } from '@/lib/domain/onboarding/constants';
import { calcDailyTargets } from '@/lib/domain/onboarding/tdee';
import type { BiologicalSex } from '@/lib/domain/onboarding/types';

/**
 * The calculator pages' own arithmetic, on top of the app's: everything that
 * decides a calorie target comes from `lib/domain/onboarding/tdee.ts`, so a
 * page can promise the same number Kallo sets at sign-up. What lives here is
 * only what the app never needed: a finish date, protein ranges, BMI bands.
 */

export interface GoalPlan {
  /** Daily calories to eat, after the app's floor. */
  targetKcal: number;
  /** kg per week the target really delivers (slower than asked when floored). */
  paceKgPerWeek: number;
  /** True when the floor stopped the asked pace. */
  floored: boolean;
  /** Whole weeks to the goal weight, or null when there is nothing to change. */
  weeks: number | null;
}

/**
 * Daily target and time to a goal weight. Losing uses the app's "cutting"
 * maths, gaining its "bulking", both at the asked pace in kg/week. The 7,700
 * kcal-per-kg rule behind the pace is a straight line; real loss slows as the
 * body gets smaller, so the weeks are a best case, said as much on the page.
 */
export function goalPlan(input: {
  tdee: number;
  sex: BiologicalSex;
  weightKg: number;
  goalKg: number;
  paceKgPerWeek: number;
}): GoalPlan {
  const { tdee, sex, weightKg, goalKg, paceKgPerWeek } = input;
  if (goalKg === weightKg) {
    return { targetKcal: tdee, paceKgPerWeek: 0, floored: false, weeks: null };
  }
  const losing = goalKg < weightKg;
  const { calories } = calcDailyTargets(
    tdee,
    losing ? 'cutting' : 'bulking',
    paceKgPerWeek,
    'moderate_carb',
    sex
  );
  // AGGRESSION_KCAL_PER_KG is daily kcal per kg/week (7,700 / 7).
  const pace = Math.abs(tdee - calories) / AGGRESSION_KCAL_PER_KG;
  const floored = losing && pace < paceKgPerWeek - 0.005;
  return {
    targetKcal: calories,
    paceKgPerWeek: pace,
    floored,
    weeks: pace > 0 ? Math.ceil(Math.abs(weightKg - goalKg) / pace) : null,
  };
}

export type ProteinGoal = 'health' | 'muscle' | 'cut';

export interface ProteinRange {
  lowG: number;
  highG: number;
  /** The grams per kg the range is built from, for the page to show. */
  lowPerKg: number;
  highPerKg: number;
  /** "lean" when the range is per kg of lean mass (cut with body fat given). */
  basis: 'body' | 'lean';
}

/**
 * Grams of protein a day.
 * - health: 0.8 g/kg, the RDA (the minimum to avoid deficiency, not a target
 *   for training).
 * - muscle: 1.4–2.0 g/kg (ISSN 2017 position stand); Morton et al. 2018 put
 *   the point past which gains stop at 1.62 g/kg.
 * - cut: 2.3–3.1 g per kg of lean mass (ISSN, resistance-trained people in a
 *   deficit) when body fat is known; otherwise the muscle range per kg of body
 *   weight, since per-kg-of-body-weight figures for dieting are not what the
 *   sources give.
 */
export function proteinRange(input: {
  weightKg: number;
  goal: ProteinGoal;
  bodyFatPct?: number | null;
}): ProteinRange {
  const { weightKg, goal, bodyFatPct } = input;
  const make = (
    low: number,
    high: number,
    kg: number,
    basis: ProteinRange['basis']
  ): ProteinRange => ({
    lowG: Math.round(low * kg),
    highG: Math.round(high * kg),
    lowPerKg: low,
    highPerKg: high,
    basis,
  });
  if (goal === 'health') return make(0.8, 0.8, weightKg, 'body');
  if (goal === 'cut' && bodyFatPct != null && bodyFatPct > 0 && bodyFatPct < 70)
    return make(2.3, 3.1, weightKg * (1 - bodyFatPct / 100), 'lean');
  return make(1.4, 2.0, weightKg, 'body');
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiBand = 'under' | 'normal' | 'over' | 'obese';

/**
 * WHO's international bands (overweight from 25, obese from 30) and the WHO
 * Western Pacific / IASO / IOTF 2000 Asia-Pacific bands (overweight from 23,
 * obese from 25), the ones Vietnamese hospitals use. Same underweight line.
 */
export function bmiBand(value: number, standard: 'who' | 'asia'): BmiBand {
  const [over, obese] = standard === 'who' ? [25, 30] : [23, 25];
  if (value < 18.5) return 'under';
  if (value < over) return 'normal';
  if (value < obese) return 'over';
  return 'obese';
}

/** The weight range a height counts as "normal" under one standard. */
export function normalWeightRange(
  heightCm: number,
  standard: 'who' | 'asia'
): [number, number] {
  const m2 = (heightCm / 100) ** 2;
  const top = standard === 'who' ? 24.9 : 22.9;
  return [Math.round(18.5 * m2 * 10) / 10, Math.round(top * m2 * 10) / 10];
}

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const ftInToCm = (ft: number, inches: number) =>
  (ft * 12 + inches) * CM_PER_IN;
