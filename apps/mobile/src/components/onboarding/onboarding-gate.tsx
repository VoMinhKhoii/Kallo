import { useEffect, useState } from 'react';
import {
  getOnboardingResumeStep,
  shouldShowOnboardingResume,
} from '~/lib/onboarding/logic/progress';
import { useProfile } from '~/lib/onboarding/hooks/use-profile';
import { useSession } from '~/lib/session';
import { WizardModal } from '~/components/onboarding/wizard/wizard-modal';

/**
 * Mounts the onboarding wizard as an overlay over the authenticated app
 * (mirrors the web AppShell holding `showOnboarding`). The web auto-opens only
 * on a user's first session; on mobile we auto-open ONCE per app session when
 * onboarding is incomplete (no first-session signal yet), so an unfinished
 * profile is prompted to complete it (which also unlocks the consistency map).
 * Closing it (X) keeps it closed for the session.
 */
export function OnboardingGate() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isSuccess } = useProfile(!!userId);
  const [open, setOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const onboardingStep = profile?.onboardingStep ?? 0;
  // Only decide "onboarding incomplete" from a SUCCESSFUL fetch. A failed
  // profile request leaves `profile` undefined; treating that as a new user
  // would wrongly pop the wizard over an existing, fully-onboarded account
  // (and risk overwriting their profile). On error we stay closed and let the
  // query retry / the user retry by reopening the app.
  const incomplete =
    isSuccess &&
    !!userId &&
    shouldShowOnboardingResume(profile ?? null, onboardingStep);

  useEffect(() => {
    if (incomplete && !autoOpened) {
      setOpen(true);
      setAutoOpened(true);
    }
  }, [incomplete, autoOpened]);

  if (!open || !userId) return null;

  return (
    <WizardModal
      initialStep={getOnboardingResumeStep(profile ?? null, onboardingStep)}
      initialProfile={profile ?? null}
      onClose={() => setOpen(false)}
      onComplete={() => setOpen(false)}
    />
  );
}
