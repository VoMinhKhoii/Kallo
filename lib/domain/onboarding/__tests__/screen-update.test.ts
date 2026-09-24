import { describe, expect, it } from 'vitest';
import { buildScreenUpdate } from '@/lib/domain/onboarding/screen-update';

const cooking = {
  oilUsage: 'normal',
  defaultRicePortion: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
};

describe('buildScreenUpdate', () => {
  it('advancing the last screen raises the step and stamps completion', () => {
    const update = buildScreenUpdate({ onboardingStep: 0 }, 3, cooking, {
      advance: true,
    });
    expect(update).toMatchObject({ ...cooking, onboardingStep: 3 });
    expect(update.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('a Settings edit writes the fields and leaves progress alone', () => {
    // A user who skipped onboarding saving their cooking habits from
    // Settings: no body, no targets — this must not read as "completed".
    const update = buildScreenUpdate({ onboardingStep: 0 }, 3, cooking, {
      advance: false,
    });
    expect(update).toEqual(cooking);
  });

  it('never lowers the step or re-stamps a finished profile', () => {
    const completedAt = new Date('2026-01-01');
    const update = buildScreenUpdate(
      { onboardingStep: 3, onboardingCompletedAt: completedAt },
      1,
      { countryOfOrigin: 'Vietnam' },
      { advance: true }
    );
    expect(update.onboardingStep).toBe(3);
    expect(update).not.toHaveProperty('onboardingCompletedAt');
  });

  it('a wizard Skip advances without writing fields', () => {
    expect(
      buildScreenUpdate({ onboardingStep: 1 }, 2, {}, { advance: true })
    ).toEqual({ onboardingStep: 2 });
  });

  it('an empty Settings edit writes nothing', () => {
    expect(
      buildScreenUpdate({ onboardingStep: 1 }, 2, {}, { advance: false })
    ).toEqual({});
  });

  it('writes only the step fields the payload carries', () => {
    // The Settings body page posts its own fields: no goal, no targets, and
    // above all no 500 kcal floor written over a target it never sent.
    const update = buildScreenUpdate(
      { onboardingStep: 3 },
      2,
      { weightKg: 70, heightCm: 172, age: 29, biologicalSex: 'male' },
      { advance: false }
    );
    expect(update).toEqual({
      weightKg: 70,
      heightCm: 172,
      age: 29,
      biologicalSex: 'male',
    });
  });

  it('a full step-2 payload still maps aggression and the calorie floor', () => {
    const update = buildScreenUpdate(
      {},
      2,
      { goal: 'maintaining', aggression: null, calorieTarget: 300 },
      { advance: false }
    );
    expect(update).toEqual({
      goal: 'maintaining',
      aggression: null,
      calorieTarget: 500,
    });
  });
});
