import { describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/lib/ai/cache/embedding-cache';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';
import {
  createV2SpeculativeMatcher,
  extractIngredientNames,
  extractV2CanonicalNames,
} from '../speculative';

describe('extractIngredientNames', () => {
  it('extracts names from partial JSON stream', () => {
    const seen = new Set<string>();
    const partial =
      '{"mealItems":[{"name":"Cơm","ingredients":[{"name":"Gạo tẻ","estimatedGrams":200';
    const names = extractIngredientNames(partial, seen);
    // Both "Cơm" (meal item) and "Gạo tẻ" (ingredient) are extracted
    expect(names).toContain('Cơm');
    expect(names).toContain('Gạo tẻ');
  });

  it('tracks seen names and returns only new ones', () => {
    const seen = new Set<string>();
    const partial1 =
      '{"mealItems":[{"name":"Cơm","ingredients":[{"name":"Gạo tẻ"';
    extractIngredientNames(partial1, seen);

    // Second chunk adds a new ingredient
    const partial2 = `${partial1},{"name":"Thịt bò","estimatedGrams":150}`;
    const newNames = extractIngredientNames(partial2, seen);
    expect(newNames).toEqual(['Thịt bò']);
    expect(newNames).not.toContain('Gạo tẻ');
    expect(newNames).not.toContain('Cơm');
  });

  it('returns empty array when no new names found', () => {
    const seen = new Set<string>(['Cơm', 'Gạo tẻ']);
    const partial = '{"name":"Cơm","ingredients":[{"name":"Gạo tẻ"}]}';
    expect(extractIngredientNames(partial, seen)).toEqual([]);
  });

  it('handles empty string', () => {
    expect(extractIngredientNames('', new Set())).toEqual([]);
  });

  it('handles malformed JSON gracefully', () => {
    const partial = '{"name":"Incomplete';
    // Should not crash — regex just won't match incomplete strings
    expect(extractIngredientNames(partial, new Set())).toEqual([]);
  });

  it('extracts names with Vietnamese diacritics', () => {
    const seen = new Set<string>();
    const partial =
      '{"name":"Bún bò Huế","ingredients":[{"name":"Bún phở"},{"name":"Thịt bò"}]}';
    const names = extractIngredientNames(partial, seen);
    expect(names).toContain('Bún bò Huế');
    expect(names).toContain('Bún phở');
    expect(names).toContain('Thịt bò');
  });
});

describe('extractV2CanonicalNames', () => {
  it('extracts canonicalName (not rawName/name) from the v2 stream', () => {
    const seen = new Set<string>();
    const partial =
      '{"mealItems":[{"name":"Cơm","ingredients":[{"rawName":"cơm trắng","canonicalName":"Gạo tẻ"';
    const names = extractV2CanonicalNames(partial, seen);
    expect(names).toEqual(['Gạo tẻ']);
    // The legacy "name"/"rawName" fields must NOT be picked up here.
    expect(names).not.toContain('Cơm');
    expect(names).not.toContain('cơm trắng');
  });

  it('returns only new canonical names across chunks', () => {
    const seen = new Set<string>();
    const c1 = '{"ingredients":[{"canonicalName":"Gạo tẻ"';
    extractV2CanonicalNames(c1, seen);
    const c2 = `${c1}},{"canonicalName":"Thịt bò"}`;
    expect(extractV2CanonicalNames(c2, seen)).toEqual(['Thịt bò']);
  });
});

describe('createV2SpeculativeMatcher', () => {
  function mocks() {
    clearMemoryCache();
    const db = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as AppDb;
    const generateEmbedding = vi.fn().mockResolvedValue(Array(768).fill(0.1));
    const gemini = { generateEmbedding } as unknown as GeminiClient;
    return { db, gemini, generateEmbedding };
  }

  it('fires an embedding for a canonicalName on L1/L2 miss', async () => {
    const { db, gemini, generateEmbedding } = mocks();
    const onChunk = createV2SpeculativeMatcher(db, gemini);
    onChunk('{"ingredients":[{"canonicalName":"Thịt bò"}]}');
    await vi.waitFor(() =>
      expect(generateEmbedding).toHaveBeenCalledWith('Thịt bò')
    );
  });

  it('dedupes case-variant canonical names to one embed', async () => {
    const { db, gemini, generateEmbedding } = mocks();
    const onChunk = createV2SpeculativeMatcher(db, gemini);
    onChunk('{"ingredients":[{"canonicalName":"cà rốt"}]}');
    onChunk('{"ingredients":[{"canonicalName":"Cà rốt"}]}');
    await vi.waitFor(() => expect(generateEmbedding).toHaveBeenCalled());
    // Both normalize to the same key → a single embed.
    expect(generateEmbedding).toHaveBeenCalledTimes(1);
  });

  it('does not fire embeds once the signal is aborted', async () => {
    const { db, gemini, generateEmbedding } = mocks();
    const ctrl = new AbortController();
    const onChunk = createV2SpeculativeMatcher(db, gemini, ctrl.signal);
    ctrl.abort();
    onChunk('{"ingredients":[{"canonicalName":"Thịt bò"}]}');
    await new Promise((r) => setTimeout(r, 10));
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it('never throws / rejects into the caller even if embedding fails', async () => {
    const { db } = mocks();
    const gemini = {
      generateEmbedding: vi.fn().mockRejectedValue(new Error('gemini down')),
    } as unknown as GeminiClient;
    const onChunk = createV2SpeculativeMatcher(db, gemini);
    // Synchronous call must not throw.
    expect(() =>
      onChunk('{"ingredients":[{"canonicalName":"Thịt bò"}]}')
    ).not.toThrow();
    // And the background rejection must be swallowed.
    await new Promise((r) => setTimeout(r, 10));
  });
});
