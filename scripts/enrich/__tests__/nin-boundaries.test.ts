import { describe, expect, it } from 'vitest';
import { parseDbNames } from '../nin-duplicates';
import { renderNinMigration } from '../nin-migration';
import {
  type ConstructedRow,
  dbNameRowSchema,
  insertedIdsSchema,
  nutritionSchema,
  type SnapshotRow,
  snapshotRowSchema,
} from '../nin-types';

function snapshotRow(overrides: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    _id: 'source-id',
    code: '1',
    name_vi: 'Gạo',
    name_en: null,
    category: 'Ngũ cốc',
    categoryEn: null,
    nutrition: [],
    energy: 100,
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

describe('NIN ingest boundaries', () => {
  it('validates external TSV and inserted-ID artifacts', () => {
    expect(parseDbNames('fao_vn_2007_1_raw\tGạo tẻ\tcơm|gạo')).toEqual([
      {
        id: 'fao_vn_2007_1_raw',
        namePrimary: 'Gạo tẻ',
        nameAlt: ['cơm', 'gạo'],
        source: 'fao',
      },
    ]);
    expect(() => parseDbNames('\tMissing ID\talias')).toThrow();
    expect(() => parseDbNames('only\ttwo-fields')).toThrow('expected 3 fields');
    expect(() => insertedIdsSchema.parse(['usda_1_raw'])).toThrow();
  });

  it('rejects negative nutrients and blank source identifiers', () => {
    expect(
      nutritionSchema.parse({ name: 'Carbohydrate', value: -0.03, unit: 'g' })
    ).toMatchObject({ value: 0 });
    expect(() =>
      nutritionSchema.parse({ name: 'Protein', value: -1, unit: 'g' })
    ).toThrow();
    expect(() =>
      snapshotRowSchema.parse(snapshotRow({ energy: -1 }))
    ).toThrow();
    expect(() => snapshotRowSchema.parse(snapshotRow({ _id: '  ' }))).toThrow();
    expect(() =>
      dbNameRowSchema.parse({
        id: '  ',
        namePrimary: 'Gạo',
        nameAlt: [],
        source: 'fao',
      })
    ).toThrow();
    expect(insertedIdsSchema.parse(['  nin_web_1  '])).toEqual(['nin_web_1']);
  });

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
});
