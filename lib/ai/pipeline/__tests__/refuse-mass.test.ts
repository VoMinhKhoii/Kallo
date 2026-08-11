import { describe, expect, it } from 'vitest';
import { resolveGroundedMass, resolveRefusePct } from '../refuse-mass';

describe('resolveRefusePct', () => {
  it.each([
    ['rib', 'sườn dê', '', 20, 40],
    ['wing', 'cánh gà', '', 80, 50],
    ['whole fish', 'cá nguyên con', '', 20, 35],
    ['shell-on shrimp', 'tôm còn vỏ', '', 80, 55],
    ['bone-in leg', 'đùi gà cả xương', '', 10, 25],
  ])('clamps the %s class to its band', (_, canonicalName, rawName, model, expected) => {
    const result = resolveRefusePct({
      modelRefusePct: model,
      candidateInediblePct: null,
      canonicalName,
      rawName,
    });
    expect(result.appliedRefusePct).toBe(expected);
    expect(result.appliedRefuseSource).toBe('model_cut_band');
  });

  it.each([
    ['cá hồi áp chảo', 'salmon fillet', []],
    ['cá hồi phi lê', '', []],
    ['đùi gà rút xương', '', []],
    ['trứng gà luộc', '3 boiled eggs', []],
    ['thịt heo', '', ['tách riêng phần nạc']],
    ['crab meat', '', []],
    ['crabmeat', '', []],
    ['tôm không vỏ', '', []],
    ['tôm bóc vỏ', '', []],
    ['tôm lột vỏ', '', []],
  ])('served-form evidence forces zero refuse for %s', (canonicalName, rawName, prepNotes) => {
    const result = resolveRefusePct({
      modelRefusePct: 0,
      candidateInediblePct: 40,
      canonicalName,
      rawName,
      prepNotes,
    });
    expect(result.appliedRefusePct).toBe(0);
    expect(result.appliedRefuseSource).toBe('explicit_served_form');
    expect(result.candidateDbRefusePct).toBe(40);
  });

  it.each([
    ['miếng cá', '', 40],
    ['tom boc vo', 'peeled shrimp', 45],
    ['thit cua', 'picked crab meat', 65],
    ['trung ga luoc', '3 boiled eggs', 14],
  ])('overrides a nonzero model/DB refuse value for boneless control %s', (canonicalName, rawName, refusePct) => {
    expect(
      resolveRefusePct({
        modelRefusePct: refusePct,
        candidateInediblePct: refusePct,
        canonicalName,
        rawName,
      })
    ).toMatchObject({
      appliedRefusePct: 0,
      appliedRefuseSource: 'explicit_served_form',
    });
  });

  it('records candidate DB refuse but never uses it in arithmetic', () => {
    expect(
      resolveRefusePct({
        modelRefusePct: 60,
        candidateInediblePct: 25,
        canonicalName: 'ghẹ',
        rawName: 'crab',
      })
    ).toMatchObject({
      modelRefusePct: 60,
      candidateDbRefusePct: 25,
      appliedRefusePct: 60,
      appliedRefuseSource: 'model_cut_band',
    });
  });

  it('allows an unclassified 65% crab estimate without a global 60% cap', () => {
    expect(
      resolveRefusePct({
        modelRefusePct: 65,
        candidateInediblePct: 68,
        canonicalName: 'ghẹ',
        rawName: 'crab',
      }).appliedRefusePct
    ).toBe(65);
  });

  it('flags but does not clamp a model zero on a refuse-bearing cut', () => {
    expect(
      resolveRefusePct({
        modelRefusePct: 0,
        candidateInediblePct: null,
        canonicalName: 'sườn dê',
        rawName: 'goat rib',
      })
    ).toMatchObject({
      appliedRefusePct: 0,
      appliedRefuseSource: 'model_cut_band',
      cutClass: 'rib',
      degenerateZero: true,
    });
  });

  it.each([
    ['cơm tấm sườn nướng', '', 20],
    ['thịt đùi', '', 10],
  ])('does not force an ambiguous boneless control into a cut band: %s', (canonicalName, rawName, modelRefusePct) => {
    expect(
      resolveRefusePct({
        modelRefusePct,
        candidateInediblePct: 60,
        canonicalName,
        rawName,
      })
    ).toMatchObject({
      appliedRefusePct: modelRefusePct,
      appliedRefuseSource: 'model_unknown_form',
      cutClass: null,
      degenerateZero: false,
    });
  });

  it.each([
    'sườn cốt lết',
    'suon cotlet',
    'pork chop',
  ])('does not classify a pork chop as a rib: %s', (canonicalName) => {
    expect(
      resolveRefusePct({
        modelRefusePct: 15,
        candidateInediblePct: null,
        canonicalName,
        rawName: '',
      })
    ).toMatchObject({
      appliedRefusePct: 15,
      appliedRefuseSource: 'model_unknown_form',
      cutClass: null,
    });
  });
});

describe('resolveGroundedMass', () => {
  const ground = {
    ingredientName: 'sườn heo',
    selectedCandidateId: 'c1' as const,
    grossG: 220,
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
      canonicalName: 'Sườn heo lọc xương',
      rawName: 'boneless pork rib meat',
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

  it('deducts refuse exactly once from a gross prior anchor', () => {
    const result = resolveGroundedMass({
      ground,
      candidateInediblePct: null,
      canonicalName: 'Sườn heo',
      rawName: '1 miếng sườn heo',
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
    ['fish-fillet', 'miếng cá', 90],
    ['peeled-shrimp', 'tôm không vỏ', 16],
    ['picked-crab-meat', 'crab meat', 65],
    ['peeled-egg', 'trứng gà luộc', 50],
  ])('never deducts refuse from the edible %s prior', (_, canonicalName, grams) => {
    const result = resolveGroundedMass({
      ground: { ...ground, grossG: grams, refusePct: 60 },
      candidateInediblePct: 60,
      canonicalName,
      rawName: canonicalName,
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
});
