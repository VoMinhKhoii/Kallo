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
