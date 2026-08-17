import { describe, expect, it } from 'vitest';
import {
  getOnboardingResumeStep,
  hasSavedOnboardingProfileData,
  shouldShowOnboardingResume,
} from '@/lib/onboarding/progress';

describe('hasSavedOnboardingProfileData', () => {
  it('returns false when a profile has no saved onboarding fields', () => {
    expect(
      hasSavedOnboardingProfileData({
        onboardingStep: 3,
        onboardingCompletedAt: new Date(),
      })
    ).toBe(false);
  });

  it('returns true when any onboarding field is saved', () => {
    expect(
      hasSavedOnboardingProfileData({
        onboardingStep: 3,
        countryOfResidence: 'Vietnam',
      })
    ).toBe(true);
  });
});

describe('shouldShowOnboardingResume', () => {
  it('keeps the sidebar resume CTA visible after skipping every screen', () => {
    expect(
      shouldShowOnboardingResume(
        {
          onboardingStep: 3,
          onboardingCompletedAt: new Date(),
        },
        3
      )
    ).toBe(true);
  });

  it('hides the sidebar resume CTA after onboarding has real saved data', () => {
    expect(
      shouldShowOnboardingResume(
        {
          onboardingStep: 3,
          countryOfOrigin: 'Vietnam',
        },
        3
      )
    ).toBe(false);
  });
});

describe('getOnboardingResumeStep', () => {
  it('reopens at step 1 when onboarding was only skipped', () => {
    expect(getOnboardingResumeStep({ onboardingStep: 3 }, 3)).toBe(1);
  });

  it('reopens at the next step when real onboarding data exists', () => {
    expect(
      getOnboardingResumeStep(
        {
          onboardingStep: 2,
          goal: 'maintaining',
        },
        2
      )
    ).toBe(3);
  });
});
