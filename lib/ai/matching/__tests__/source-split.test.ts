import { describe, expect, it } from 'vitest';
import {
  type SourcedMatchRow,
  splitBySource,
} from '@/lib/ai/matching/match-constants';

function candidate(sourceId: number, sourceCode: string): SourcedMatchRow {
  return {
    id: `source-${sourceId}`,
    name_primary: 'food',
    name_alt: null,
    name_en: 'food',
    state: 'raw',
    source_id: sourceId,
    source_code: sourceCode,
    similarity: 1,
  };
}

describe('splitBySource', () => {
  it('routes additive curated sources through the Vietnamese threshold', () => {
    // The live registry ids: `ingredient_sources.id` is a serial, so NIN and
    // OFF landed on 6 and 5 there, not the 4 and 3 their insert order implies.
    const result = splitBySource([
      candidate(1, 'FAO_VN_2007'),
      candidate(2, 'USDA_SR'),
      candidate(5, 'OFF'),
      candidate(6, 'NIN_WEB_2026'),
    ]);
    expect(result.fao.map((row) => row.id)).toEqual(['source-1', 'source-6']);
    expect(result.usda.map((row) => row.id)).toEqual(['source-2']);
  });

  it('buckets by source code whatever id the registry assigned', () => {
    const result = splitBySource([
      candidate(4, 'NIN_WEB_2026'),
      candidate(9, 'USDA_SR'),
    ]);
    expect(result.fao.map((row) => row.id)).toEqual(['source-4']);
    expect(result.usda.map((row) => row.id)).toEqual(['source-9']);
  });

  it('keeps packaged-product sources out of ingredient matching', () => {
    const result = splitBySource([
      candidate(5, 'OFF'),
      candidate(7, 'USDA_FDC'),
      candidate(8, 'SOME_FUTURE_SOURCE'),
    ]);
    expect(result.fao).toEqual([]);
    expect(result.usda).toEqual([]);
  });
});
