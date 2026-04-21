import { describe, expect, it } from 'vitest';
import {
  buildSeedSql,
  escapeSqlString,
  formatPgVector,
  parseCsv,
} from '@/scripts/generate-seed-food-sql';

describe('formatPgVector', () => {
  it('formats pgvector literals', () => {
    expect(formatPgVector([0.1, 0.2, 0.3])).toBe("'[0.1,0.2,0.3]'");
  });
});

describe('escapeSqlString', () => {
  it('escapes single quotes for SQL strings', () => {
    expect(escapeSqlString("Nước mắm 'đậm'")).toBe("Nước mắm ''đậm''");
  });
});

describe('parseCsv', () => {
  it('parses quoted commas and empty numeric cells', () => {
    const rows = parseCsv(
      [
        'id,name_primary,calories_kcal,name_alt',
        'food-1,"Cá, kho",,"[""một, hai"",""ba""]"',
        '',
      ].join('\n')
    );

    expect(rows).toEqual([
      {
        id: 'food-1',
        name_primary: 'Cá, kho',
        calories_kcal: '',
        name_alt: '["một, hai","ba"]',
      },
    ]);
  });
});

describe('buildSeedSql', () => {
  it('supports the documented CSV shape and normalizes query cache keys', () => {
    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: "NƯỚC MẮM 'ĐẬM'",
        name_alt: '["một, hai","ba"]',
        name_en: 'Fish sauce',
        type_vn: 'Gia vị, nước chấm',
        type_en: 'Condiments',
        source: 'FAO_VN_2007',
        state: 'raw',
        inedible_portion_pct: '',
        calories_kcal: '10',
        protein_g: '',
        carbohydrate_g: '',
        fat_g: '',
        fiber_g: '',
        sodium_mg: '',
        calcium_mg: '',
        iron_mg: '',
        magnesium_mg: '',
        phosphorus_mg: '',
        potassium_mg: '',
        zinc_mg: '',
        copper_mcg: '',
        manganese_mg: '',
        beta_carotene_mcg: '',
        vitamin_a_mcg: '',
        vitamin_d_mcg: '',
        vitamin_e_mg: '',
        vitamin_k_mcg: '',
        vitamin_c_mg: '',
        vitamin_b1_mg: '',
        vitamin_b2_mg: '',
        vitamin_pp_mg: '',
        vitamin_b5_mg: '',
        vitamin_b6_mg: '',
        vitamin_b9_mcg: '',
        vitamin_b12_mcg: '',
        vitamin_h_mcg: '',
        last_verified: '2026-02-26',
        search_text: 'Nước mắm đậm Fish sauce',
        embedding: '[0.1,0.2,0.3]',
        search_text_ascii: 'nuoc mam dam fish sauce',
      },
    ]);

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('INSERT INTO vietnamese_food_composition');
    expect(sql).toContain("NƯỚC MẮM ''ĐẬM''");
    expect(sql).toContain("ARRAY['một, hai','ba']");
    expect(sql).toContain('::vector(768)');
    expect(sql).toContain('INSERT INTO ingredient_query_embeddings');
    expect(sql).toContain(
      "('nước mắm ''đậm''', 'Fish sauce', '[0.1,0.2,0.3]'::vector(768))"
    );
    expect(sql).toContain(', 1, ');
    expect(sql).toContain('COMMIT;');
  });

  it('fails fast when neither source_id nor source is present', () => {
    expect(() =>
      buildSeedSql([
        {
          id: 'food-1',
          name_primary: 'Test',
          name_alt: '[]',
          name_en: 'Test',
          type_vn: 'Test',
          type_en: 'Test',
          state: 'raw',
          inedible_portion_pct: '',
          calories_kcal: '',
          protein_g: '',
          carbohydrate_g: '',
          fat_g: '',
          fiber_g: '',
          sodium_mg: '',
          calcium_mg: '',
          iron_mg: '',
          magnesium_mg: '',
          phosphorus_mg: '',
          potassium_mg: '',
          zinc_mg: '',
          copper_mcg: '',
          manganese_mg: '',
          beta_carotene_mcg: '',
          vitamin_a_mcg: '',
          vitamin_d_mcg: '',
          vitamin_e_mg: '',
          vitamin_k_mcg: '',
          vitamin_c_mg: '',
          vitamin_b1_mg: '',
          vitamin_b2_mg: '',
          vitamin_pp_mg: '',
          vitamin_b5_mg: '',
          vitamin_b6_mg: '',
          vitamin_b9_mcg: '',
          vitamin_b12_mcg: '',
          vitamin_h_mcg: '',
          last_verified: '2026-02-26',
        },
      ])
    ).toThrow('Missing required CSV columns: source_id or source');
  });

  it('rejects malformed non-numeric source_id values', () => {
    expect(() =>
      buildSeedSql([
        {
          id: 'food-1',
          name_primary: 'Test',
          name_alt: '[]',
          name_en: 'Test',
          type_vn: 'Test',
          type_en: 'Test',
          source_id: 'FAO_VN_2007',
          state: 'raw',
          inedible_portion_pct: '',
          calories_kcal: '',
          protein_g: '',
          carbohydrate_g: '',
          fat_g: '',
          fiber_g: '',
          sodium_mg: '',
          calcium_mg: '',
          iron_mg: '',
          magnesium_mg: '',
          phosphorus_mg: '',
          potassium_mg: '',
          zinc_mg: '',
          copper_mcg: '',
          manganese_mg: '',
          beta_carotene_mcg: '',
          vitamin_a_mcg: '',
          vitamin_d_mcg: '',
          vitamin_e_mg: '',
          vitamin_k_mcg: '',
          vitamin_c_mg: '',
          vitamin_b1_mg: '',
          vitamin_b2_mg: '',
          vitamin_pp_mg: '',
          vitamin_b5_mg: '',
          vitamin_b6_mg: '',
          vitamin_b9_mcg: '',
          vitamin_b12_mcg: '',
          vitamin_h_mcg: '',
          last_verified: '2026-02-26',
        },
      ])
    ).toThrow(
      'Invalid source_id "FAO_VN_2007". Expected a numeric ID or omit source_id and provide source.'
    );
  });
});
