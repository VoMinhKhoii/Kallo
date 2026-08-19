import { describe, expect, it } from 'vitest';
import { rerankCandidates } from '@/lib/ai/matching/rank/candidate-ranking';

describe('rerankCandidates', () => {
  const makeCand = (name: string, sim: number) => ({
    id: `id-${name}`,
    name_primary: name,
    name_alt: null,
    name_en: '',
    state: 'raw',
    similarity: sim,
  });

  it('returns candidates sorted by similarity descending', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
      makeCand('Trứng vịt', 0.72),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Quả trứng gà');
    expect(result[0].similarity).toBeCloseTo(0.8);
    expect(result[1].name_primary).toBe('Trứng gà');
    expect(result[2].name_primary).toBe('Trứng vịt');
  });

  it('preserves original similarity scores unchanged', () => {
    const candidates = [
      makeCand('Quả trứng gà', 0.8),
      makeCand('Trứng gà', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].similarity).toBeCloseTo(0.8);
    expect(result[1].similarity).toBeCloseTo(0.78);
  });

  it('sorts correctly without modifying scores', () => {
    const candidates = [
      makeCand('Bột gạo nếp', 0.82),
      makeCand('Gạo nếp cái', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Bột gạo nếp');
    expect(result[0].similarity).toBeCloseTo(0.82);
    expect(result[1].similarity).toBeCloseTo(0.78);
  });

  it('returns higher-similarity candidate first regardless of name', () => {
    const candidates = [
      makeCand('Bánh đậu xanh', 0.83),
      makeCand('Đậu xanh (đậu tắt)', 0.75),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Bánh đậu xanh');
    expect(result[0].similarity).toBeCloseTo(0.83);
    expect(result[1].similarity).toBeCloseTo(0.75);
  });

  it('returns single candidate unchanged', () => {
    const candidates = [makeCand('Thịt bò', 0.8)];
    const result = rerankCandidates(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.8);
  });

  it('returns empty array unchanged', () => {
    const result = rerankCandidates([]);
    expect(result).toHaveLength(0);
  });

  it('sorts multiple candidates by similarity', () => {
    const candidates = [
      makeCand('Thịt bò', 0.75),
      makeCand('Thịt bò viên', 0.78),
    ];
    const result = rerankCandidates(candidates);
    expect(result[0].name_primary).toBe('Thịt bò viên');
    expect(result[0].similarity).toBeCloseTo(0.78);
  });
});
