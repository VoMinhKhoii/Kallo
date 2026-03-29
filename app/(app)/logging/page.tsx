import { FeedArea } from '@/components/logging/feed/feed-area';
import { TimelineSidebar } from '@/components/logging/sidebar/timeline-sidebar';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import type { MacroBreakdown } from '@/lib/types/meal';

const DEFAULT_TARGETS: MacroBreakdown = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

export default async function LoggingPage() {
  let targets = DEFAULT_TARGETS;

  try {
    const profile = await getOnboardingProfile();
    if (profile) {
      targets = {
        calories: profile.calorieTarget ?? DEFAULT_TARGETS.calories,
        protein: profile.proteinTargetG ?? DEFAULT_TARGETS.protein,
        carbs: profile.carbsTargetG ?? DEFAULT_TARGETS.carbs,
        fat: profile.fatTargetG ?? DEFAULT_TARGETS.fat,
      };
    }
  } catch (error) {
    console.error('Failed to load onboarding profile:', error);
  }

  return (
    <>
      <TimelineSidebar />
      <FeedArea targets={targets} />
    </>
  );
}
