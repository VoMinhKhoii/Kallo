'use client';

import { useEffect, useState } from 'react';
import { NudgeDialog } from '@/components/onboarding/nudge-dialog';
import { OnboardingCard } from '@/components/onboarding/onboarding-card';

const CARD_DISMISS_KEY = 'onboarding_card_dismissed_at';
const CARD_DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface OnboardingPromptProps {
  onboardingStep: number;
  accountCreatedAt: string | Date;
}

export function OnboardingPrompt({
  onboardingStep,
  accountCreatedAt,
}: OnboardingPromptProps) {
  const [cardDismissed, setCardDismissed] = useState(false);

  // SSR-safe localStorage read for card dismiss state with 7-day expiry
  useEffect(() => {
    const dismissedAt = localStorage.getItem(CARD_DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      setCardDismissed(elapsed < CARD_DISMISS_EXPIRY_MS);
    }
  }, []);

  function handleDismissCard() {
    localStorage.setItem(CARD_DISMISS_KEY, Date.now().toString());
    setCardDismissed(true);
  }

  return (
    <>
      {!cardDismissed && (
        <OnboardingCard
          onboardingStep={onboardingStep}
          onDismiss={handleDismissCard}
        />
      )}
      <NudgeDialog
        onboardingStep={onboardingStep}
        accountCreatedAt={accountCreatedAt}
      />
    </>
  );
}
