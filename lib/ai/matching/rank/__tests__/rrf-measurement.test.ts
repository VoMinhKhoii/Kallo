import { describe, expect, it } from 'vitest';
import type { FuzzyMatchRow } from '@/lib/ai/matching/match-constants';
import { captureRrfCandidates } from '../rrf-measurement';

const row = (
  namePrimary: string,
  similarity: number,
  state = 'raw'
): FuzzyMatchRow => ({
  id: `id-${namePrimary}`,
  name_primary: namePrimary,
  name_alt: null,
  name_en: namePrimary,
  state,
  similarity,
});

describe('captureRrfCandidates', () => {
  it('returns top-k from each source in normalized shape', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [row('Cá quả', 0.91), row('Cá lóc', 0.85)],
      vectorRowsUsda: [],
      fuzzyRowsFao: [row('Cá quả', 0.78)],
      fuzzyRowsUsda: [row('Cá thu', 0.62)],
      topK: 3,
    });

    expect(out.vectorTop[0].canonicalName).toBe('Cá quả');
    expect(out.vectorTop[0].source).toBe('fao');
    expect(out.fuzzyTop.find((c) => c.source === 'usda')?.canonicalName).toBe(
      'Cá thu'
    );
  });

  it('locks candidate shape to exactly four non-PII fields', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [row('Cá quả', 0.91)],
      vectorRowsUsda: [],
      fuzzyRowsFao: [row('Cá quả', 0.78)],
      fuzzyRowsUsda: [],
      topK: 1,
    });

    expect(Object.keys(out.vectorTop[0]).sort()).toEqual([
      'canonicalName',
      'similarity',
      'source',
      'state',
    ]);
  });

  it('round-trips raw and cooked state into candidates', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [row('Thịt bò', 0.9, 'cooked')],
      vectorRowsUsda: [],
      fuzzyRowsFao: [],
      fuzzyRowsUsda: [],
      topK: 1,
    });

    expect(out.vectorTop[0].state).toBe('cooked');
  });

  it('coerces unknown DB state values to unknown', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [row('X', 0.9, 'wholething')],
      vectorRowsUsda: [],
      fuzzyRowsFao: [],
      fuzzyRowsUsda: [],
      topK: 1,
    });

    expect(out.vectorTop[0].state).toBe('unknown');
  });

  it('flags topVectorEqualsTopFuzzy when top-1 match by name and source', () => {
    const same = captureRrfCandidates({
      vectorRowsFao: [row('Cá quả', 0.91)],
      vectorRowsUsda: [],
      fuzzyRowsFao: [row('Cá quả', 0.78)],
      fuzzyRowsUsda: [],
      topK: 3,
    });
    expect(same.topVectorEqualsTopFuzzy).toBe(true);

    const different = captureRrfCandidates({
      vectorRowsFao: [row('Cá quả', 0.91)],
      vectorRowsUsda: [],
      fuzzyRowsFao: [row('Cá thu', 0.78)],
      fuzzyRowsUsda: [],
      topK: 3,
    });
    expect(different.topVectorEqualsTopFuzzy).toBe(false);
  });

  it('includes source in top-1 equality', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [row('Cá quả', 0.91)],
      vectorRowsUsda: [],
      fuzzyRowsFao: [],
      fuzzyRowsUsda: [row('Cá quả', 0.78)],
      topK: 3,
    });

    expect(out.topVectorEqualsTopFuzzy).toBe(false);
  });

  it('handles empty lists gracefully', () => {
    const out = captureRrfCandidates({
      vectorRowsFao: [],
      vectorRowsUsda: [],
      fuzzyRowsFao: [],
      fuzzyRowsUsda: [],
      topK: 3,
    });

    expect(out.vectorTop).toEqual([]);
    expect(out.fuzzyTop).toEqual([]);
    expect(out.topVectorEqualsTopFuzzy).toBe(false);
  });

  it('truncates merged lists to topK across both sources', () => {
    const manyFao = Array.from({ length: 5 }, (_, i) =>
      row(`F${i}`, 0.95 - i * 0.05)
    );
    const manyUsda = Array.from({ length: 5 }, (_, i) =>
      row(`U${i}`, 0.92 - i * 0.05)
    );

    const out = captureRrfCandidates({
      vectorRowsFao: manyFao,
      vectorRowsUsda: manyUsda,
      fuzzyRowsFao: manyFao,
      fuzzyRowsUsda: manyUsda,
      topK: 3,
    });

    expect(out.vectorTop).toHaveLength(3);
    expect(out.fuzzyTop).toHaveLength(3);
    expect(out.vectorTop.map((c) => c.canonicalName)).toEqual([
      'F0',
      'U0',
      'F1',
    ]);
  });
});
