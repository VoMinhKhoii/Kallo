import type {
  MealInputLanguage,
  SupportedOutputLanguage,
} from '@/lib/ai/language/detect';
import type { CookingHabits, Goal } from '@/lib/onboarding/types';

// User context (gathered from user_profiles for pipeline)

/** User context needed by the pipeline — queried from user_profiles at call time */
export interface UserContext {
  goal: Goal;
  aggression: number; // 0.1-0.8 for cutting/bulking, 0 for maintaining (null → 0)
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
  inputLanguage?: MealInputLanguage;
  outputLanguage?: SupportedOutputLanguage;
  cookingHabits: CookingHabits;
}
