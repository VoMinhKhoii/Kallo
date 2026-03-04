import { ChatArea } from '@/components/logging/chat-area';
import { TimelineSidebar } from '@/components/logging/timeline-sidebar';
import { OnboardingPrompt } from '@/components/onboarding/onboarding-prompt';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';

export default async function LoggingPage() {
  const profile = await getOnboardingProfile();

  return (
    <>
      {profile &&
        (profile.onboardingStep ?? 0) <
          ONBOARDING_REQUIRED_STEP && (
          <OnboardingPrompt
            onboardingStep={
              profile.onboardingStep ?? 0
            }
            accountCreatedAt={profile.createdAt}
          />
        )}
      <TimelineSidebar />
      <ChatArea />
    </>
  );
}
