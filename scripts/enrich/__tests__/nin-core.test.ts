import { describe, expect, it } from 'vitest';
import { atwaterResult, classify, normalizeRows } from '../nin-core';
import { buildDbNameIndex, findDuplicate } from '../nin-duplicates';
import type { SnapshotRow } from '../nin-types';

function row(overrides: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    _id: 'id',
    code: '1',
    name_vi: 'Cà bát, luộc',
    name_en: null,
    category: 'Rau',
    categoryEn: null,
    energy: 50,
    nutrition: [
      { name: 'Chất đạm', name_en: 'Protein', value: 2, unit: 'g' },
      { name: 'Chất béo', name_en: 'Total lipid (Fat)', value: 2, unit: 'g' },
      {
        name: 'Đường',
        name_en: 'Carbohydrate by difference',
        value: 6,
        unit: 'g',
      },
      { name: '', name_en: '', value: null, unit: '' },
    ],
    ...overrides,
  };
}

describe('NIN ingest core', () => {
  it('drops null stubs and computes Atwater energy', () => {
    const normalized = normalizeRows([row()])[0];
    expect(normalized.nutrition).toHaveLength(3);
    expect(atwaterResult(normalized)).toMatchObject({
      computed: 50,
      relativeError: 0,
      reasons: [],
    });
  });

  it('always quarantines energy=1 placeholders', () => {
    const normalized = normalizeRows([row({ energy: 1, nutrition: [] })])[0];
    expect(atwaterResult(normalized).reasons).toContain('placeholder_energy_1');
  });

  it('treats a high-overlap same-code state rename as one lineage', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_7013_raw',
        namePrimary: 'Thịt gà ta',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '7013', name_vi: 'Thịt gà ta, tươi' })])[0],
        index
      )
    ).toMatchObject({
      verdict: 'duplicate-vietnamese',
      matchBasis: 'code-lineage',
    });
  });

  it('does not code-match any row in the reassigned 4108-4126 block', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_4108_raw',
        namePrimary: 'Cà chua muối',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([
          row({ code: '4108', name_vi: 'Rau cải ngọt, tươi' }),
        ])[0],
        index
      )
    ).toMatchObject({ verdict: 'keep-no-match', matchBasis: 'none' });
  });

  it('does not code-match names with low token overlap', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_7013_raw',
        namePrimary: 'Thịt gà ta',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '7013', name_vi: 'Thịt bò thăn' })])[0],
        index
      )
    ).toMatchObject({ verdict: 'keep-no-match', matchBasis: 'none' });
  });

  it('still name-matches shifted rows in the reassigned block', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_4108_raw',
        namePrimary: 'Cà chua muối',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '4112', name_vi: 'Cà chua, muối' })])[0],
        index
      )
    ).toMatchObject({
      verdict: 'duplicate-vietnamese',
      matchBasis: 'name',
    });
  });

  it('keeps a genuinely new state variant with a new numeric code', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_1007_raw',
        namePrimary: 'Ngô cả bắp tươi',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([
          row({ code: '1007014', name_vi: 'Ngô tươi, tẻ, nướng' }),
        ])[0],
        index
      )
    ).toMatchObject({ verdict: 'keep-no-match', matchBasis: 'none' });
  });

  it('keeps USDA-only exact equivalents', () => {
    const index = buildDbNameIndex([
      {
        id: 'usda_1_cooked',
        namePrimary: 'Cà bát luộc',
        nameAlt: [],
        source: 'usda',
      },
    ]);
    expect(findDuplicate(normalizeRows([row()])[0], index).verdict).toBe(
      'keep-usda-only'
    );
  });

  it('labels review-mandated bowls and composites', () => {
    expect(
      classify(normalizeRows([row({ code: '15045', name_vi: 'Chè bưởi' })])[0])
        .label
    ).toBe('bowl');
    expect(
      classify(
        normalizeRows([row({ code: '1009', name_vi: 'Bánh bao nhân thịt' })])[0]
      ).label
    ).toBe('composite');
  });
});
