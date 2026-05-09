import { beforeEach, describe, expect, it } from 'vitest';
import type { PromptPersonalizationContext } from '../../prompts/types';
import {
  buildDecompositionCacheKey,
  createL4Cache,
  decompositionContextHash,
  type L4Cache,
} from '../decomposition-cache';

const ctx = {
  countryOfOrigin: 'VN',
  countryOfResidence: 'VN',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
  goal: 'cut',
  aggression: 'moderate',
  calorieTargetKcal: 2000,
  bodyMetrics: { heightCm: 170, weightKg: 65 },
} satisfies Partial<PromptPersonalizationContext> & Record<string, unknown>;

function makeKey(
  overrides: {
    rawInput?: string;
    decompositionPromptHash?: string;
    decompositionSchemaHash?: string;
    decompositionModel?: string;
  } = {}
) {
  return buildDecompositionCacheKey({
    rawInput: overrides.rawInput ?? 'phở bò',
    ctx,
    decompositionPromptHash:
      overrides.decompositionPromptHash ?? 'sha256:abc123',
    decompositionSchemaHash:
      overrides.decompositionSchemaHash ?? 'sha256:schema-1',
    decompositionModel: overrides.decompositionModel ?? 'gemini-2.5-flash-lite',
  });
}

describe('decompositionContextHash', () => {
  it('hashes only the allowlisted fields', () => {
    const a = decompositionContextHash(ctx);
    const changedExcluded = {
      ...ctx,
      goal: 'bulk',
      aggression: 'aggressive',
      calorieTargetKcal: 3000,
      bodyMetrics: { heightCm: 180, weightKg: 80 },
    } satisfies Partial<PromptPersonalizationContext> & Record<string, unknown>;
    const b = decompositionContextHash(changedExcluded);

    expect(a).toBe(b);
  });

  it('changes when an allowlisted field changes', () => {
    const a = decompositionContextHash(ctx);
    const b = decompositionContextHash({ ...ctx, countryOfResidence: 'US' });

    expect(a).not.toBe(b);
  });

  it('is order-insensitive over JSON keys', () => {
    const ctx2 = {
      cookingHabits: {
        brothConsumption: 'some',
        defaultProteinPortion: 'medium',
        defaultRicePortion: 'medium',
        oilUsage: 'normal',
        sugarBraised: 'medium',
      },
      countryOfResidence: 'VN',
      countryOfOrigin: 'VN',
    } satisfies Partial<PromptPersonalizationContext>;

    expect(decompositionContextHash(ctx)).toBe(decompositionContextHash(ctx2));
  });

  it('is null-safe for partial contexts', () => {
    expect(() => decompositionContextHash({})).not.toThrow();
  });

  it('ignores every known excluded personalization field', () => {
    const a = decompositionContextHash(ctx);
    const changedExcluded = {
      ...ctx,
      goal: 'bulk',
      aggression: 1,
      calorieTargetKcal: 4000,
      macroTargets: { proteinG: 200 },
      bodyMetrics: { heightCm: 190, weightKg: 95 },
      userId: 'user-should-not-key-cache',
      rawInput: 'different raw input belongs outside ctx hash',
    } satisfies Partial<PromptPersonalizationContext> & Record<string, unknown>;
    const b = decompositionContextHash(changedExcluded);

    expect(a).toBe(b);
  });
});

describe('buildDecompositionCacheKey', () => {
  it('includes raw input + context hash + prompt + schema source hashes + model', () => {
    const key = makeKey();

    expect(key).toMatch(/^l4:dec:/);
    expect(key.length).toBeGreaterThan(40);
  });

  it('changes when the rendered prompt hash changes', () => {
    const a = makeKey({ decompositionPromptHash: 'sha256:abc123' });
    const b = makeKey({ decompositionPromptHash: 'sha256:def456' });

    expect(a).not.toBe(b);
  });

  it('changes when the schema fingerprint changes', () => {
    const a = makeKey({ decompositionSchemaHash: 'sha256:schema-1' });
    const b = makeKey({ decompositionSchemaHash: 'sha256:schema-2' });

    expect(a).not.toBe(b);
  });

  it('changes when the decomposition model changes', () => {
    const a = makeKey({ decompositionModel: 'gemini-2.5-flash-lite' });
    const b = makeKey({
      decompositionModel: 'gemini-3.1-flash-lite',
    });

    expect(a).not.toBe(b);
  });

  it('normalizes raw input whitespace and case', () => {
    const a = makeKey({ rawInput: '  Phở Bò  ' });
    const b = makeKey({ rawInput: 'phở bò' });

    expect(a).toBe(b);
  });
});

describe('createL4Cache', () => {
  let cache: L4Cache<{ ingredient: string }>;

  beforeEach(() => {
    cache = createL4Cache<{ ingredient: string }>({
      maxEntries: 3,
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      now: () => 1_000_000,
    });
  });

  it('misses when key is unseen', () => {
    expect(cache.get('k1')).toBeNull();
  });

  it('hits after set', () => {
    cache.set('k1', { ingredient: 'phở' });

    expect(cache.get('k1')).toEqual({ ingredient: 'phở' });
  });

  it('evicts the oldest entry under LRU pressure', () => {
    cache.set('k1', { ingredient: 'a' });
    cache.set('k2', { ingredient: 'b' });
    cache.set('k3', { ingredient: 'c' });
    cache.get('k1');
    cache.set('k4', { ingredient: 'd' });

    expect(cache.get('k2')).toBeNull();
    expect(cache.get('k1')).toEqual({ ingredient: 'a' });
  });

  it('evicts entries past TTL', () => {
    let nowMs = 1_000_000;
    const c = createL4Cache<{ x: number }>({
      maxEntries: 5,
      ttlMs: 1000,
      now: () => nowMs,
    });

    c.set('a', { x: 1 });
    nowMs += 999;
    expect(c.get('a')).toEqual({ x: 1 });
    nowMs += 2;
    expect(c.get('a')).toBeNull();
  });
});
