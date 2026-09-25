import { describe, expect, it } from 'vitest';
import { resolveMacroSource, scaleGroundedMacros } from '../macro-scaling';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

describe('resolveMacroSource', () => {
  const lean = {
    ingredientName: 'mì gói',
    selectedCandidateId: 'c1',
    grossG: 80,
    refusePct: 0,
    fatG: triple(14),
  };

  it('anchors an accepted candidate with nutrition to the DB', () => {
    expect(
      resolveMacroSource({
        acceptedCandidate: { nutrition: {} },
        ground: lean,
        resolvedGrams: 80,
      })
    ).toEqual({ kind: 'db' });
  });

  it('carves out (never zero-fills) an accepted row whose nutrition never loaded and whose P/C were omitted', () => {
    // The mì-gói incident shape: no DB anchor and no model carbs. A zero
    // triple here would persist as C:0g; `none` routes it to the carve-out
    // the completeness gate can fail on.
    expect(
      resolveMacroSource({
        acceptedCandidate: { nutrition: null },
        ground: lean,
        resolvedGrams: 80,
      })
    ).toEqual({ kind: 'none', reason: 'no_estimate' });
  });

  it('uses the model triples when there is no DB anchor and P/C are present', () => {
    expect(
      resolveMacroSource({
        acceptedCandidate: null,
        ground: {
          ...lean,
          selectedCandidateId: 'none',
          proteinG: triple(8),
          carbohydrateG: triple(48),
        },
        resolvedGrams: 80,
      })
    ).toEqual({ kind: 'llm' });
  });
});

describe('scaleGroundedMacros', () => {
  it('keeps omitted P/C absent instead of turning them into zeros', () => {
    const out = scaleGroundedMacros(
      {
        ingredientName: 'cơm',
        selectedCandidateId: 'c1',
        grossG: 200,
        refusePct: 0,
        fatG: triple(1),
      },
      400,
      200
    );
    expect(out.proteinG).toBeUndefined();
    expect(out.carbohydrateG).toBeUndefined();
    expect(out.fatG.mid).toBe(2);
  });
});
