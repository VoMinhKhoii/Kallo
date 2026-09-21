import { describe, expect, it } from 'vitest';
import { toCheatRecap } from '@/lib/domain/cheat/feed-recap';

// This runs on EVERY circle-feed read, across every cheat row ever written.
// A payload shape it cannot handle does not produce a bad card — it throws and
// takes the whole feed down, for everyone in that friendship graph. So the
// malformed cases below matter more than the happy one.

function slider(key: string, label: string, defaultLevel: number) {
  return {
    key,
    label,
    defaultLevel,
    anchors: [
      { level: 0, label: 'không có', proteinG: 0 },
      { level: 4, label: 'vừa phải', proteinG: 30 },
      { level: 8, label: 'khá nhiều', proteinG: 60 },
      { level: 10, label: 'rất nhiều', proteinG: 80 },
    ],
  };
}

const persisted = {
  spec: {
    sliders: [
      slider('protein', 'Thịt / hải sản', 4),
      slider('fat', 'Dầu mỡ', 2),
    ],
    mealSlot: 'dinner',
    confidence: 'medium',
  },
  levels: { protein: 8 },
};

describe('toCheatRecap', () => {
  it('reports where the logger actually put each slider', () => {
    const recap = toCheatRecap(persisted);

    expect(recap).toHaveLength(2);
    // Protein was dragged to 8, past the spec's default of 4.
    expect(recap?.[0]).toEqual({
      key: 'protein',
      label: 'Thịt / hải sản',
      level: 8,
      anchorLabel: 'khá nhiều',
    });
  });

  it('falls back to the estimator default for an axis never touched', () => {
    // `levels` only carries protein. Fat still has a position — the default is
    // what the meal's numbers were actually computed from, so reporting 0 or
    // dropping the row would both misdescribe what was eaten.
    const recap = toCheatRecap(persisted);

    expect(recap?.[1]).toMatchObject({ key: 'fat', level: 2 });
    // The anchor at or BELOW 2, not the nearest one.
    expect(recap?.[1]?.anchorLabel).toBe('không có');
  });

  it('clamps a level outside the 0..10 range', () => {
    const recap = toCheatRecap({
      ...persisted,
      levels: { protein: 99, fat: -4 },
    });

    expect(recap?.[0]?.level).toBe(10);
    expect(recap?.[1]?.level).toBe(0);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'cheat'],
    ['a number', 7],
    ['an empty object', {}],
    ['a spec with no sliders array', { spec: {}, levels: {} }],
    ['sliders that are not an array', { spec: { sliders: 'nope' } }],
    ['an empty slider list', { spec: { sliders: [] }, levels: {} }],
  ])('returns null for %s rather than throwing', (_name, payload) => {
    expect(() => toCheatRecap(payload)).not.toThrow();
    expect(toCheatRecap(payload)).toBeNull();
  });

  it('survives a legacy row that has a spec but no levels at all', () => {
    // The exact shape that broke stage-cheat-copy before it was shape-checked:
    // older rows were written without `levels`.
    const recap = toCheatRecap({ spec: persisted.spec });

    expect(recap).toHaveLength(2);
    // With nothing chosen, every axis reads at its default.
    expect(recap?.[0]?.level).toBe(4);
  });

  it('skips a malformed slider without losing the rest', () => {
    const recap = toCheatRecap({
      spec: {
        sliders: [
          { key: 'protein' }, // no anchors
          null,
          slider('carbs', 'Cơm', 6),
        ],
      },
      levels: {},
    });

    expect(recap).toHaveLength(1);
    expect(recap?.[0]?.key).toBe('carbs');
  });
});
