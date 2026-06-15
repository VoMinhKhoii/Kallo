import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getOnboardingProfileMock, getTranslationsMock } = vi.hoisted(() => ({
  getOnboardingProfileMock: vi.fn(),
  getTranslationsMock: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: getTranslationsMock,
}));

vi.mock('@/lib/onboarding/actions', () => ({
  getOnboardingProfile: getOnboardingProfileMock,
}));

vi.mock('@/components/dashboard/dashboard-shell', () => ({
  DashboardShell: () => <div>Dashboard Shell</div>,
}));

import DashboardPage, { generateMetadata } from './page';

describe('DashboardPage', () => {
  beforeEach(() => {
    getOnboardingProfileMock.mockReset();
    getTranslationsMock.mockReset();

    getTranslationsMock.mockResolvedValue((key: string) => key);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dashboard metadata', async () => {
    const metadata = await generateMetadata();

    expect(metadata).toEqual({
      title: 'title',
    });
  });

  it('falls back to logging-style default targets when profile targets are missing', async () => {
    getOnboardingProfileMock.mockResolvedValue({
      onboardingStep: 1,
      calorieTarget: null,
      proteinTargetG: null,
      carbsTargetG: null,
      fatTargetG: null,
    });

    const page = await DashboardPage();

    expect(page).toBeTruthy();
    expect(page?.props).toEqual({
      profile: {
        calorieTarget: 2000,
        proteinTargetG: 150,
        carbsTargetG: 250,
        fatTargetG: 65,
      },
    });
    expect(page?.type).toBeDefined();
  });

  it('renders the full dashboard when targets are present', async () => {
    getOnboardingProfileMock.mockResolvedValue({
      calorieTarget: 1800,
      proteinTargetG: 140,
      carbsTargetG: 180,
      fatTargetG: 60,
    });

    const page = await DashboardPage();

    expect(page).toBeTruthy();
    expect(page?.props).toEqual({
      profile: {
        calorieTarget: 1800,
        proteinTargetG: 140,
        carbsTargetG: 180,
        fatTargetG: 60,
      },
    });
    expect(page?.type).toBeDefined();
  });

  it('mixes saved targets with defaults when only some values are missing', async () => {
    getOnboardingProfileMock.mockResolvedValue({
      calorieTarget: 1800,
      proteinTargetG: null,
      carbsTargetG: 180,
      fatTargetG: null,
    });

    const page = await DashboardPage();

    expect(page).toBeTruthy();
    expect(page?.props).toEqual({
      profile: {
        calorieTarget: 1800,
        proteinTargetG: 150,
        carbsTargetG: 180,
        fatTargetG: 65,
      },
    });
    expect(page?.type).toBeDefined();
  });
});
