import { describe, expect, it } from 'vitest';
import {
  resolveGroundedMass,
  resolveRefusePct,
} from '@/lib/ai/pipeline/resolve/refuse-mass';

describe('resolveRefusePct', () => {
  it.each([
    // Prod request 2b1da66e: "xương nạc" (meaty bones) once read as a
    // boneless "nạc" and dropped 45% to 0. The model's share now always ships.
    [45, 45],
    [0, 0],
    [55, 55],
    [65, 65],
  ])('applies the model refusePct %i verbatim', (model, expected) => {
    expect(
      resolveRefusePct({ modelRefusePct: model, candidateInediblePct: null })
    ).toMatchObject({
      modelRefusePct: model,
      appliedRefusePct: expected,
      appliedRefuseSource: 'model',
    });
  });

  it.each([
    [-5, 0],
    [95, 80],
  ])('clamps an out-of-range refusePct %i to %i', (model, expected) => {
    expect(
      resolveRefusePct({ modelRefusePct: model, candidateInediblePct: null })
        .appliedRefusePct
    ).toBe(expected);
  });

  it('records candidate DB refuse but never uses it in arithmetic', () => {
    expect(
      resolveRefusePct({ modelRefusePct: 60, candidateInediblePct: 25 })
    ).toMatchObject({
      candidateDbRefusePct: 25,
      appliedRefusePct: 60,
    });
  });
});

describe('resolveGroundedMass', () => {
  const ground = {
    ingredientName: 'sườn heo',
    selectedCandidateId: 'c1' as const,
    grossG: 220,
    refuseKind: 'bone' as const,
    refusePct: 50,
    caloriesKcal: { low: 0, mid: 0, high: 0 },
    proteinG: { low: 0, mid: 0, high: 0 },
    carbohydrateG: { low: 0, mid: 0, high: 0 },
    fatG: { low: 0, mid: 0, high: 0 },
  };

  it('keeps an edible resolver anchor authoritative', () => {
    const result = resolveGroundedMass({
      ground,
      candidateInediblePct: 60,
      authoritativeMass: {
        grams: 200,
        basis: 'edible',
      },
    });
    expect(result.edibleG).toBe(200);
    expect(result.refuse).toMatchObject({
      grossG: 220,
      appliedRefusePct: 0,
      appliedRefuseSource: 'authoritative_edible_anchor',
      edibleG: 200,
      massBasis: 'edible',
    });
  });

  it.each([
    ['bone', 50, false],
    ['none', 0, false],
    ['none', 30, true],
    ['shell', 0, true],
  ] as const)('logs refuseKind %s at %i%% (mismatch: %s) and still ships the model share', (kind, pct, mismatch) => {
    const result = resolveGroundedMass({
      ground: { ...ground, refuseKind: kind, refusePct: pct },
      candidateInediblePct: null,
    });
    expect(result.edibleG).toBeCloseTo(220 * (1 - pct / 100));
    expect(result.refuse).toMatchObject({
      refuseKind: kind,
      refuseKindMismatch: mismatch,
      appliedRefusePct: pct,
    });
  });

  it('deducts refuse exactly once from a gross prior anchor', () => {
    const result = resolveGroundedMass({
      ground,
      candidateInediblePct: null,
      authoritativeMass: {
        grams: 200,
        basis: 'gross_as_served',
      },
    });
    expect(result.edibleG).toBe(100);
    expect(result.refuse).toMatchObject({
      grossG: 200,
      modelRefusePct: 50,
      appliedRefusePct: 50,
      edibleG: 100,
      massBasis: 'gross_as_served',
    });
  });

  it.each([
    90, 16, 65, 50,
  ])('never deducts refuse from an edible %ig anchor', (grams) => {
    const result = resolveGroundedMass({
      ground: {
        ...ground,
        grossG: grams,
        refuseKind: 'bone' as const,
        refusePct: 60,
      },
      candidateInediblePct: 60,
      authoritativeMass: {
        grams,
        basis: 'edible',
      },
    });
    expect(result.edibleG).toBe(grams);
    expect(result.refuse).toMatchObject({
      appliedRefusePct: 0,
      appliedRefuseSource: 'authoritative_edible_anchor',
      edibleG: grams,
      massBasis: 'edible',
    });
  });

  it('does not treat an unknown-basis ingredient as authoritative edible mass', () => {
    const result = resolveGroundedMass({
      ground: {
        ...ground,
        grossG: 200,
        refuseKind: 'bone' as const,
        refusePct: 25,
      },
      candidateInediblePct: null,
      authoritativeMass: {
        grams: 300,
        basis: 'unknown',
      },
    });
    expect(result.edibleG).toBe(150);
    expect(result.refuse).toMatchObject({
      grossG: 200,
      appliedRefusePct: 25,
      appliedRefuseSource: 'model',
      massBasis: 'gross_as_served',
    });
  });
});
