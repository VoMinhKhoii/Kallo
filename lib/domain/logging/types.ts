import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';
import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * The signed-in user's logging context: who they are and what a day is
 * supposed to add up to. Read by the logging shell, the feed, and the hooks
 * that decide whether a day is over or under target.
 */
export interface LoggingProfile {
  userId: string;
  goal: Goal;
  aggression: number;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

/**
 * What the composer is currently logging: free text (`normal`), typed-in rows
 * with their own macros (`manual`), or an indulgence with a magnitude
 * (`cheat`).
 */
export type InputMode = 'normal' | 'manual' | 'cheat';

/** The Premium feature behind each gated mode. Manual is free. */
export const MODE_FEATURE: {
  readonly normal: FeatureKey;
  readonly cheat: FeatureKey;
  readonly manual?: undefined;
} = {
  normal: 'ai_analysis',
  cheat: 'cheat_meal',
};

/**
 * One day the timeline knows about, and what it came to.
 *
 * `kcal` is null when the day holds nothing countable — a staged card whose
 * nutrition is still inside its JSONB, or meals saved without calorie data.
 * Null is not zero: the sidebar shows nothing rather than claiming an empty
 * day. Note the public `/api/v1/meals/dates` route flattens this back to bare
 * date strings for the Flutter client.
 */
export interface MealDateSummary {
  /** YYYY-MM-DD, in the timezone the caller asked for. */
  date: string;
  kcal: number | null;
}
