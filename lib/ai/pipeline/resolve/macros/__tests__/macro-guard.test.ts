import { afterEach, describe, expect, it, vi } from 'vitest';
import { __testing } from '@/lib/ai/pipeline/resolve/macros/bounded-macros';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('__testing.guardMacro', () => {
  it('returns input verbatim when mid is within 3× of base', () => {
    const out = __testing.guardMacro(
      { low: 200, mid: 270, high: 350 },
      270, // base
      'test ingredient',
      'caloriesKcal'
    );
    expect(out).toEqual({ low: 200, mid: 270, high: 350 });
  });

  it('clamps a plain overshoot to the ceiling instead of returning base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 5400, mid: 5511, high: 5600 },
      270, // base; ratio is 5511/270 ≈ 20×, way above 3× guard
      'Sườn non',
      'caloriesKcal'
    );
    expect(out.mid).toBeCloseTo(810, 8);
    expect(out.mid).not.toBe(270);
    expect(out.low).toBeLessThanOrEqual(out.mid);
    expect(out.high).toBeGreaterThanOrEqual(out.mid);
    expect(warn).toHaveBeenCalled();
  });

  it('clamps an undershoot up to the floor instead of returning base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 1, mid: 5, high: 10 },
      100, // base; ratio is 5/100 = 0.05× → below 1/3 guard
      'test',
      'caloriesKcal'
    );
    expect(out.mid).toBeCloseTo(100 / 3, 8);
    expect(warn).toHaveBeenCalled();
  });

  it('trusts LLM when base is 0 (e.g., pepper has no kcal entry)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 0, mid: 0.3, high: 0.5 },
      0, // base undefined for this nutrient
      'tiêu',
      'caloriesKcal'
    );
    expect(out).toEqual({ low: 0, mid: 0.3, high: 0.5 });
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to base band when LLM emits an unordered triple (low > mid)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 30, mid: 20, high: 40 }, // low > mid
      25, // ratio 0.8× — would pass the cooking-envelope check
      'pork rib',
      'fatG'
    );
    expect(out.mid).toBe(25);
    expect(out.low).toBeLessThanOrEqual(out.mid);
    expect(out.high).toBeGreaterThanOrEqual(out.mid);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toMatch(/reason=invalid/);
  });

  it('falls back to base band when LLM emits unordered triple (mid > high)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 5, mid: 15, high: 10 }, // mid > high
      12,
      'item',
      'fatG'
    );
    expect(out.mid).toBe(12);
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to base band on NaN/Infinity', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: Number.NaN, mid: 10, high: 15 },
      10,
      'broken',
      'fatG'
    );
    expect(Number.isFinite(out.low)).toBe(true);
    expect(out.mid).toBe(10);
    expect(warn).toHaveBeenCalled();
  });

  it('with base=0, returns {0,0,0} when LLM triple is structurally invalid', () => {
    const out = __testing.guardMacro(
      { low: 0.5, mid: 0.3, high: 0.1 }, // low > mid > high
      0,
      'pepper',
      'fatG'
    );
    expect(out).toEqual({ low: 0, mid: 0, high: 0 });
  });
});

describe('__testing.isStructurallyInvalidTriple', () => {
  it('returns false for an ordered, finite, non-negative triple', () => {
    expect(
      __testing.isStructurallyInvalidTriple({ low: 1, mid: 2, high: 3 })
    ).toBe(false);
  });

  it('returns true for unordered triples', () => {
    expect(
      __testing.isStructurallyInvalidTriple({ low: 3, mid: 2, high: 1 })
    ).toBe(true);
    expect(
      __testing.isStructurallyInvalidTriple({ low: 2, mid: 1, high: 3 })
    ).toBe(true);
    expect(
      __testing.isStructurallyInvalidTriple({ low: 1, mid: 3, high: 2 })
    ).toBe(true);
  });

  it('returns true for negative values', () => {
    expect(
      __testing.isStructurallyInvalidTriple({ low: -1, mid: 0, high: 1 })
    ).toBe(true);
  });

  it('returns true for non-finite values', () => {
    expect(
      __testing.isStructurallyInvalidTriple({
        low: 0,
        mid: Number.POSITIVE_INFINITY,
        high: 0,
      })
    ).toBe(true);
    expect(
      __testing.isStructurallyInvalidTriple({
        low: 0,
        mid: 1,
        high: Number.NaN,
      })
    ).toBe(true);
  });
});

describe('__testing.flatTriple', () => {
  it('produces a flat triple at the supplied value (no artificial spread)', () => {
    const out = __testing.flatTriple(20);
    expect(out).toEqual({ low: 20, mid: 20, high: 20 });
  });

  it('returns all zeros for a zero input', () => {
    const out = __testing.flatTriple(0);
    expect(out).toEqual({ low: 0, mid: 0, high: 0 });
  });

  it('coerces negative input to zero (defensive: DB values are non-negative)', () => {
    const out = __testing.flatTriple(-5);
    expect(out).toEqual({ low: 0, mid: 0, high: 0 });
  });
});

describe('__testing.deriveCaloriesFromMacros', () => {
  it('applies the macro identity 4P + 4C + 9F per bound', () => {
    const out = __testing.deriveCaloriesFromMacros(
      { low: 8, mid: 10, high: 12 },
      { low: 17, mid: 20, high: 23 },
      { low: 4, mid: 5, high: 6 }
    );
    expect(out.low).toBe(4 * 8 + 4 * 17 + 9 * 4);
    expect(out.mid).toBe(4 * 10 + 4 * 20 + 9 * 5);
    expect(out.high).toBe(4 * 12 + 4 * 23 + 9 * 6);
  });
});

describe('__testing.guardMacro — tighter prep-notes ratios', () => {
  it('accepts a 2× fat overshoot under prep-notes ratio (extra oil case)', () => {
    const out = __testing.guardMacro(
      { low: 9, mid: 10, high: 11 },
      5, // base
      'omelette',
      'fatG',
      2 // PREP_NOTES_FAT_MAX_RATIO
    );
    expect(out.mid).toBe(10);
  });

  // The displayed number is not always `mid`. Goal adjustment computes
  // `mid + aggression × (goal_bound − mid)`, so a cutting user at full
  // aggression is shown `high` outright. A guard that bounds only `mid` leaves
  // the number the user actually reads unbounded.
  it('holds every bound inside the envelope, not just mid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // mid sits comfortably inside 5×3 + 15 = 30, but high is far outside it.
    const out = __testing.guardMacro(
      { low: 4, mid: 5, high: 50 },
      5,
      'cá chiên',
      'fatG',
      3,
      15 // shallow-fry absorbed-oil allowance
    );
    expect(out.mid).toBe(5);
    expect(out.high).toBe(30);
    expect(out.low).toBeGreaterThanOrEqual(5 / 3);
    expect(out.low).toBeLessThanOrEqual(out.mid);
    expect(out.mid).toBeLessThanOrEqual(out.high);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves a fully in-envelope triple untouched', () => {
    const raw = { low: 4, mid: 6, high: 9 };
    expect(__testing.guardMacro(raw, 5, 'cá', 'fatG', 3, 0)).toBe(raw);
  });

  it('keeps high inside the ceiling after an overshooting mid is scaled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Scaling alone would map high 200 → 60, still double the 30 ceiling.
    const out = __testing.guardMacro(
      { low: 50, mid: 100, high: 200 },
      5,
      'cá chiên',
      'fatG',
      3,
      15
    );
    expect(out.high).toBeLessThanOrEqual(30);
    expect(out.mid).toBeLessThanOrEqual(out.high);
    warn.mockRestore();
  });

  it('clamps fat to the prep-notes ceiling when it exceeds 2×', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 14, mid: 15, high: 16 }, // 3× base
      5,
      'omelette',
      'fatG',
      2
    );
    expect(out.mid).toBe(10);
    expect(warn).toHaveBeenCalled();
  });

  it('clamps fat to the prep-notes floor when it drops below 0.5× base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 0.5, mid: 1, high: 1.5 }, // 0.2× base
      5,
      'omelette',
      'fatG',
      2
    );
    expect(out.mid).toBe(2.5);
    expect(warn).toHaveBeenCalled();
  });

  it('protein at 1.3× base passes the 1.4× prep-notes guard', () => {
    const out = __testing.guardMacro(
      { low: 12, mid: 13, high: 14 },
      10,
      'chicken skinless',
      'proteinG',
      1.4
    );
    expect(out.mid).toBe(13);
  });

  it('protein at 1.5× base is clamped (overshoot)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 14, mid: 15, high: 16 },
      10,
      'chicken skinless',
      'proteinG',
      1.4
    );
    expect(out.mid).toBe(14);
    expect(warn).toHaveBeenCalled();
  });
});
