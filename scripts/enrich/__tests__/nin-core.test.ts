import { describe, expect, it } from 'vitest';
import {
  atwaterResult,
  classify,
  constructRows,
  dedupeClones,
  normalizeRows,
} from '../nin-core';
import { buildDbNameIndex, findDuplicate } from '../nin-duplicates';
import { renderNinMigration } from '../nin-migration';
import type { ConstructedRow, SnapshotRow } from '../nin-types';

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

function constructedRow(
  overrides: Partial<ConstructedRow> = {}
): ConstructedRow {
  return {
    id: 'nin_web_2',
    code: '2',
    namePrimary: "Bánh O'Brien",
    nameAlt: ["O'Brien", 'Bánh thử'],
    nameEn: 'Test cake',
    typeVn: 'Bánh',
    typeEn: 'Cake',
    state: 'cooked',
    caloriesKcal: 100,
    proteinG: 2,
    carbohydrateG: 20,
    fatG: null,
    fiberG: 1,
    waterG: null,
    ...overrides,
  };
}

describe('NIN ingest core', () => {
  it('renders deterministic, idempotent migration SQL in id order', () => {
    const sql = renderNinMigration(
      [constructedRow(), constructedRow({ id: 'nin_web_1', code: '1' })],
      {
        snapshotSha256: 'abc123',
        pullDate: '2026-08-12',
        counts: {
          loaded: 853,
          quarantined: 27,
          cloneRowsDropped: 23,
          bowlsExcluded: 35,
          vietnameseDuplicates: 510,
          constructed: 2,
        },
      }
    );

    expect(sql.startsWith('SET search_path TO public, extensions;\n')).toBe(
      true
    );
    expect(sql).toContain('Snapshot SHA-256: abc123');
    expect(sql).toContain('853->2');
    expect(sql).not.toContain('"embedding"');
    expect(sql).toContain("'Bánh O''Brien'");
    expect(sql).toContain("ARRAY['O''Brien', 'Bánh thử']::text[]");
    expect(sql).toContain('ON CONFLICT ("id") DO NOTHING;');
    expect(sql.indexOf("'nin_web_1'")).toBeLessThan(sql.indexOf("'nin_web_2'"));
  });

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

  it('retains verified near-zero foods instead of treating them as placeholders', () => {
    const [salt, mineralWater, ice, tea] = normalizeRows([
      row({ code: '13005', name_vi: 'Muối', energy: 1, nutrition: [] }),
      row({ code: '14008', name_vi: 'Nước khoáng', energy: 1, nutrition: [] }),
      row({ code: '14057', name_vi: 'Nước đá', energy: 1, nutrition: [] }),
      row({ code: '14070', name_vi: 'Trà túi lọc', energy: 1, nutrition: [] }),
    ]);

    expect([salt.energy, mineralWater.energy, ice.energy]).toEqual([0, 0, 0]);
    expect([salt, mineralWater, ice, tea].map(atwaterResult)).toEqual([
      expect.objectContaining({ reasons: [] }),
      expect.objectContaining({ reasons: [] }),
      expect.objectContaining({ reasons: [] }),
      expect.objectContaining({ reasons: [] }),
    ]);
  });

  it('keeps review-mandated clone rows and prefers a generic clone carrier', () => {
    const shrimpNutrition = row().nutrition.map((nutrient, index) =>
      index === 0 ? { ...nutrient, value: 3 } : nutrient
    );
    const normalized = normalizeRows([
      row({ code: '12090', name_vi: 'Bánh rán nhân đỗ' }),
      row({ code: '12091', name_vi: 'Bánh tiêu' }),
      row({ code: '15075', name_vi: 'Cháo dinh dưỡng thịt bò' }),
      row({ code: '15076', name_vi: 'Cháo dinh dưỡng tôm' }),
      row({ code: '14069', name_vi: 'Trà Neste' }),
      row({ code: '14070', name_vi: 'Trà túi lọc' }),
      row({
        code: '8093',
        name_vi: 'Tôm tít (bề bề)',
        energy: 60,
        nutrition: shrimpNutrition,
      }),
      row({
        code: '8051',
        name_vi: 'Tôm biển, tươi',
        energy: 60,
        nutrition: shrimpNutrition,
      }),
    ]);

    const result = dedupeClones(normalized);
    expect(result.kept.map((item) => item.code)).toEqual([
      '12090',
      '12091',
      '15075',
      '15076',
      '14070',
      '8051',
    ]);
    expect(result.groups[0]?.kept.code).toBe('14070');
    expect(result.groups[1]?.kept.code).toBe('8051');
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

  it('does not collapse an explicitly cooked row onto a raw lineage', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_7068_raw',
        namePrimary: 'Giò bò',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '7068', name_vi: 'Giò bò, chín' })])[0],
        index
      )
    ).toMatchObject({ verdict: 'keep-no-match', matchBasis: 'none' });
  });

  it('does not collapse an explicitly raw row onto a cooked lineage', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_5001_cooked',
        namePrimary: 'Bưởi',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '5001', name_vi: 'Bưởi, tươi' })])[0],
        index
      )
    ).toMatchObject({ verdict: 'keep-no-match', matchBasis: 'none' });
  });

  it('treats ripe fresh fruit as raw rather than cooked', () => {
    const index = buildDbNameIndex([
      {
        id: 'fao_vn_2007_5055_raw',
        namePrimary: 'Xoài chín',
        nameAlt: [],
        source: 'fao',
      },
    ]);
    expect(
      findDuplicate(
        normalizeRows([row({ code: '5055', name_vi: 'Xoài chín, tươi' })])[0],
        index
      )
    ).toMatchObject({
      verdict: 'duplicate-vietnamese',
      matchBasis: 'code-lineage',
    });
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
    expect(
      classify(normalizeRows([row({ code: '15040', name_vi: 'Caramen' })])[0])
        .label
    ).toBe('composite');
  });

  it('constructs prepared foods as cooked and preserves raw and dried states', () => {
    const constructed = constructRows(
      normalizeRows([
        row({ code: '15006', name_vi: 'Bánh chưng' }),
        row({ code: '15009', name_vi: 'Bánh cuốn' }),
        row({ code: '15017', name_vi: 'Bánh giò' }),
        row({ code: '1032', name_vi: 'Bánh mì, vuông, ngọt' }),
        row({ code: '7143', name_vi: 'Xúc xích bò' }),
        row({ code: '8064', name_vi: 'Chả cá basa' }),
        row({
          code: '11022',
          name_vi: 'Cá ngừ',
          category: 'Đồ hộp',
          categoryEn: 'Canned food',
        }),
        row({ code: '4108', name_vi: 'Rau cải ngọt, tươi' }),
        row({ code: '4125', name_vi: 'Mộc nhĩ, khô' }),
      ])
    );

    expect(constructed.map(({ id, state }) => [id, state])).toEqual([
      ['nin_web_15006', 'cooked'],
      ['nin_web_15009', 'cooked'],
      ['nin_web_15017', 'cooked'],
      ['nin_web_1032', 'cooked'],
      ['nin_web_7143', 'cooked'],
      ['nin_web_8064', 'cooked'],
      ['nin_web_11022', 'cooked'],
      ['nin_web_4108', 'raw'],
      ['nin_web_4125', 'raw'],
    ]);
  });
});
