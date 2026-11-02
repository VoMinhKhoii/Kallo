import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/onboarding/screen/route';
import { PUT } from '@/app/api/v1/profile/route';

const { set, select, getRequestUser } = vi.hoisted(() => ({
  set: vi.fn(),
  select: vi.fn(),
  getRequestUser: vi.fn(),
}));
vi.mock('@/lib/infra/auth/session', () => ({ getRequestUser }));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: select }) }) }),
    update: () => ({
      set: (value: unknown) => {
        set(value);
        return { where: vi.fn().mockResolvedValue([]) };
      },
    }),
  },
}));

import {
  saveOnboardingScreen,
  saveProfileSettings,
} from '@/lib/domain/onboarding/actions';

const profile = {
  biologicalSex: 'male',
  weightKg: 70,
  heightCm: 170,
  age: 30,
  activityLevel: 'moderate',
  goal: 'maintaining',
  aggression: null,
  carbSplit: 'moderate_carb',
  tdeeKcal: 2400,
  calorieTarget: 2400,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 80,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: null,
  preferredLocale: 'en',
  oilUsage: 'normal',
  defaultRicePortion: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
};

describe('profile write validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 'test-user' });
    select.mockResolvedValue([{ onboardingStep: 0 }]);
  });

  it.each([
    'countryOfOrigin',
    'countryOfResidence',
  ])('rejects invalid %s before either action writes', async (field) => {
    for (const value of ['x'.repeat(101), 'a<b', 'a>b', 'a\nb', 'a\rb']) {
      await expect(
        saveOnboardingScreen(1, { [field]: value })
      ).rejects.toThrow();
      await expect(
        saveProfileSettings({ ...profile, [field]: value })
      ).rejects.toThrow();
    }
    expect(set).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it.each([0, 4, 1.5, NaN])('rejects invalid step %s', async (step) => {
    await expect(saveOnboardingScreen(step, {})).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it('enforces the same country bound through both REST handlers', async () => {
    const request = (body: unknown) =>
      new NextRequest('http://localhost/api/v1/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    for (const countryOfOrigin of ['x'.repeat(101), '<country>', 'a\nb']) {
      const screen = await POST(
        request({ step: 1, data: { countryOfOrigin }, advance: false })
      );
      const settings = await PUT(request({ ...profile, countryOfOrigin }));
      expect(screen.status).toBe(400);
      expect(settings.status).toBe(400);
    }
    expect(set).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          request({
            step: 1,
            data: { countryOfOrigin: 'Vietnam' },
            advance: false,
          })
        )
      ).status
    ).toBe(200);
    expect((await PUT(request(profile))).status).toBe(200);
  });

  it('rejects wrong step-field types and invalid profile metrics', async () => {
    await expect(
      saveOnboardingScreen(1, { countryOfResidence: 123 })
    ).rejects.toThrow();
    await expect(saveOnboardingScreen(2, { weightKg: '70' })).rejects.toThrow();
    await expect(
      saveOnboardingScreen(3, { oilUsage: 'unknown' })
    ).rejects.toThrow();
    await expect(saveProfileSettings({ ...profile, age: 2 })).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it('uses parsed country values and keeps null and 100 characters', async () => {
    await saveOnboardingScreen(
      1,
      { countryOfOrigin: ' Vietnam ', countryOfResidence: null },
      { advance: false }
    );
    expect(set).toHaveBeenLastCalledWith({
      countryOfOrigin: 'Vietnam',
      countryOfResidence: null,
    });
    await saveProfileSettings({
      ...profile,
      countryOfOrigin: ` ${'x'.repeat(100)} `,
    });
    expect(set).toHaveBeenLastCalledWith(
      expect.objectContaining({ countryOfOrigin: 'x'.repeat(100) })
    );
  });

  it('accepts web/Flutter full steps, Settings subsets and empty Skip', async () => {
    const {
      countryOfOrigin,
      countryOfResidence,
      preferredLocale,
      oilUsage,
      defaultRicePortion,
      defaultProteinPortion,
      brothConsumption,
      ...body
    } = profile;
    const steps = [
      { countryOfOrigin, countryOfResidence, preferredLocale },
      { ...body, deficitOverride: null },
      { oilUsage, defaultRicePortion, defaultProteinPortion, brothConsumption },
    ];
    for (const [index, data] of steps.entries()) {
      await saveOnboardingScreen(index + 1, data);
      await saveOnboardingScreen(index + 1, {});
    }
    await saveOnboardingScreen(
      2,
      {
        weightKg: 70,
        heightCm: 170,
        age: 30,
        biologicalSex: 'male',
        activityLevel: 'moderate',
      },
      { advance: false }
    );
    expect(set).toHaveBeenLastCalledWith({
      weightKg: 70,
      heightCm: 170,
      age: 30,
      biologicalSex: 'male',
      activityLevel: 'moderate',
    });
    await saveOnboardingScreen(
      2,
      {
        goal: 'maintaining',
        aggression: null,
        carbSplit: 'moderate_carb',
        deficitOverride: null,
        tdeeKcal: 2400,
        calorieTarget: 2400,
        proteinTargetG: 150,
        carbsTargetG: 250,
        fatTargetG: 80,
      },
      { advance: false }
    );
    expect(set).toHaveBeenLastCalledWith(
      expect.objectContaining({ goal: 'maintaining' })
    );
  });
});
