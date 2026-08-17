import {
  decideMealLanguage,
  type SupportedOutputLanguage,
} from '@/lib/ai/language/detect';
import type { UserContext } from '@/lib/ai/types/user-context';
import { NEUTRAL_COOKING_DEFAULTS } from '@/lib/domain/onboarding/constants';
import type { userProfiles } from '@/lib/infra/db/schema';

type ProfileRow = typeof userProfiles.$inferSelect;

interface AiRequestContextInput {
  mealText: string;
  requestLocale?: SupportedOutputLanguage;
  profileLocale?: string | null;
}

function toSupportedOutputLanguage(
  locale: string | null | undefined
): SupportedOutputLanguage | undefined {
  return locale === 'en' || locale === 'vi' ? locale : undefined;
}

/**
 * Builds UserContext from a user profile DB row.
 * Shared by both the server action and the API route.
 *
 * Atomic goal+aggression normalization:
 * - If goal is null → maintaining + aggression 0
 * - If goal is non-maintaining but aggression is null → maintaining + aggression 0
 * This prevents impossible states (e.g. cutting with no aggression).
 */
export function buildUserContext(profile: ProfileRow): UserContext {
  const rawGoal = profile.goal as UserContext['goal'] | null;
  const rawAggression = profile.aggression ? Number(profile.aggression) : null;

  // Atomic: if goal requires aggression but it's missing, fall back to maintaining
  let goal: UserContext['goal'] = 'maintaining';
  let aggression = 0;
  if (rawGoal === 'maintaining') {
    goal = 'maintaining';
    aggression = 0;
  } else if (rawGoal && rawAggression != null) {
    goal = rawGoal;
    aggression = rawAggression;
  }
  // else: rawGoal is null OR rawGoal is cutting/bulking with null aggression → maintaining+0

  return {
    goal,
    aggression,
    countryOfOrigin: profile.countryOfOrigin ?? null,
    countryOfResidence: profile.countryOfResidence ?? null,
    cookingHabits: {
      oilUsage: (profile.oilUsage ??
        NEUTRAL_COOKING_DEFAULTS.oilUsage) as UserContext['cookingHabits']['oilUsage'],
      defaultRicePortion: (profile.defaultRicePortion ??
        NEUTRAL_COOKING_DEFAULTS.defaultRicePortion) as UserContext['cookingHabits']['defaultRicePortion'],
      sugarBraised: (profile.sugarBraised ??
        NEUTRAL_COOKING_DEFAULTS.sugarBraised) as UserContext['cookingHabits']['sugarBraised'],
      defaultProteinPortion: (profile.defaultProteinPortion ??
        NEUTRAL_COOKING_DEFAULTS.defaultProteinPortion) as UserContext['cookingHabits']['defaultProteinPortion'],
      brothConsumption: (profile.brothConsumption ??
        NEUTRAL_COOKING_DEFAULTS.brothConsumption) as UserContext['cookingHabits']['brothConsumption'],
    },
  };
}

export function buildAiRequestContext(
  userContext: UserContext,
  input: AiRequestContextInput
): UserContext {
  const language = decideMealLanguage(input.mealText, {
    localeFallback:
      input.requestLocale ?? toSupportedOutputLanguage(input.profileLocale),
  });

  return {
    ...userContext,
    inputLanguage: language.inputLanguage,
    outputLanguage: language.outputLanguage,
  };
}
