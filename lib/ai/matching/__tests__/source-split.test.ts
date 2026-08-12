import { describe, expect, it } from 'vitest';
import { type SourcedMatchRow, splitBySource } from '../match-constants';

function candidate(sourceId: number): SourcedMatchRow {
  return {
    id: `source-${sourceId}`,
    name_primary: 'food',
    name_alt: null,
    name_en: 'food',
    state: 'raw',
    source_id: sourceId,
    similarity: 1,
  };
}

describe('splitBySource', () => {
  it('routes additive curated sources through the Vietnamese threshold', () => {
    const result = splitBySource([
      candidate(1),
      candidate(2),
      candidate(3),
      candidate(4),
    ]);
    expect(result.fao.map((row) => row.id)).toEqual(['source-1', 'source-4']);
    expect(result.usda.map((row) => row.id)).toEqual(['source-2']);
  });
});
