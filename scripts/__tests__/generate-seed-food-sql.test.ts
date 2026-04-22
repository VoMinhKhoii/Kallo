import { describe, expect, it } from 'vitest';
import {
  buildSeedSql,
  escapeSqlString,
  formatPgVector,
  parseCsv,
} from '../generate-seed-food-sql';

function make768Vector(seed: number): string {
  return JSON.stringify(
    Array.from({ length: 768 }, (_, i) => seed + i * 0.001)
  );
}

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
  it('generates the expected seed SQL shape', () => {
    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: "Nước mắm 'đậm'",
        name_alt: '["một, hai","ba"]',
        name_en: 'Fish sauce',
        type_vn: 'Gia vị, nước chấm',
        type_en: 'Condiments',
        source_id: '1',
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
        embedding: make768Vector(0.1),
        search_text_ascii: 'nuoc mam dam fish sauce',
      },
    ]);

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('INSERT INTO vietnamese_food_composition');
    expect(sql).toContain("Nước mắm ''đậm''");
    expect(sql).toContain("ARRAY['một, hai','ba']");
    expect(sql).toContain('::vector(768)');
    expect(sql).toContain('INSERT INTO ingredient_query_embeddings');
    expect(sql).toContain('COMMIT;');
  });

  it('deduplicates colliding normalized query keys', () => {
    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: 'Sữa bò tươi',
        name_alt: '[]',
        name_en: 'First milk',
        type_vn: 'Sữa và sản phẩm chế biến',
        type_en: 'Milk and products',
        source_id: '1',
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
        search_text: 'Sữa bò tươi First milk',
        search_text_ascii: 'sua bo tuoi first milk',
        embedding: make768Vector(0.1),
      },
      {
        id: 'food-2',
        name_primary: ' sữa bò tươi ',
        name_alt: '[]',
        name_en: 'Second milk',
        type_vn: 'Sữa và sản phẩm chế biến',
        type_en: 'Milk and products',
        source_id: '1',
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
        search_text: 'sữa bò tươi Second milk',
        search_text_ascii: 'sua bo tuoi second milk',
        embedding: make768Vector(0.4),
      },
    ]);

    const queryStart = sql.indexOf('INSERT INTO ingredient_query_embeddings');
    const querySection = sql.slice(
      queryStart,
      sql.indexOf('ON CONFLICT (name_vi)')
    );
    const valueRows = querySection
      .split('\n')
      .filter((line) => line.trim().startsWith('('));

    expect(valueRows).toHaveLength(1);
    expect(querySection).toContain("'sữa bò tươi'");
    expect(querySection).not.toContain("'Second milk'");
  });

  it('keeps first valid embedding when colliding rows have mixed validity', () => {
    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: 'Cà phê',
        name_alt: '[]',
        name_en: 'Invalid coffee',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Cà phê Invalid coffee',
        search_text_ascii: 'ca phe invalid coffee',
        embedding: '',
      },
      {
        id: 'food-2',
        name_primary: ' Cà phê ',
        name_alt: '[]',
        name_en: 'Valid coffee',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Cà phê Valid coffee',
        search_text_ascii: 'ca phe valid coffee',
        embedding: make768Vector(0.7),
      },
    ]);

    const queryStart = sql.indexOf('INSERT INTO ingredient_query_embeddings');
    const querySection = sql.slice(
      queryStart,
      sql.indexOf('ON CONFLICT (name_vi)')
    );
    const valueRows = querySection
      .split('\n')
      .filter((line) => line.trim().startsWith('('));

    expect(valueRows).toHaveLength(1);
    expect(querySection).toContain("'cà phê'");
    expect(querySection).toContain("'Valid coffee'");
    expect(querySection).not.toContain("'Invalid coffee'");
  });

  it('skips colliding rows with wrong vector dimensions', () => {
    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: 'Trà xanh',
        name_alt: '[]',
        name_en: 'Wrong dimension tea',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Trà xanh Wrong dimension tea',
        search_text_ascii: 'tra xanh wrong dimension tea',
        embedding: '[0.1,0.2,0.3]',
      },
      {
        id: 'food-2',
        name_primary: ' Trà xanh ',
        name_alt: '[]',
        name_en: 'Correct dimension tea',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Trà xanh Correct dimension tea',
        search_text_ascii: 'tra xanh correct dimension tea',
        embedding: make768Vector(0.5),
      },
    ]);

    const queryStart = sql.indexOf('INSERT INTO ingredient_query_embeddings');
    const querySection = sql.slice(
      queryStart,
      sql.indexOf('ON CONFLICT (name_vi)')
    );
    const valueRows = querySection
      .split('\n')
      .filter((line) => line.trim().startsWith('('));

    expect(valueRows).toHaveLength(1);
    expect(querySection).toContain("'trà xanh'");
    expect(querySection).toContain("'Correct dimension tea'");
    expect(querySection).not.toContain("'Wrong dimension tea'");
  });

  it('skips colliding rows with wrong-type 768-element arrays', () => {
    const wrongTypeArray = JSON.stringify(Array(768).fill(true));

    const sql = buildSeedSql([
      {
        id: 'food-1',
        name_primary: 'Nước ép',
        name_alt: '[]',
        name_en: 'Wrong type juice',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Nước ép Wrong type juice',
        search_text_ascii: 'nuoc ep wrong type juice',
        embedding: wrongTypeArray,
      },
      {
        id: 'food-2',
        name_primary: ' Nước ép ',
        name_alt: '[]',
        name_en: 'Correct type juice',
        type_vn: 'Đồ uống',
        type_en: 'Beverages',
        source_id: '1',
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
        search_text: 'Nước ép Correct type juice',
        search_text_ascii: 'nuoc ep correct type juice',
        embedding: make768Vector(0.9),
      },
    ]);

    const queryStart = sql.indexOf('INSERT INTO ingredient_query_embeddings');
    const querySection = sql.slice(
      queryStart,
      sql.indexOf('ON CONFLICT (name_vi)')
    );
    const valueRows = querySection
      .split('\n')
      .filter((line) => line.trim().startsWith('('));

    expect(valueRows).toHaveLength(1);
    expect(querySection).toContain("'nước ép'");
    expect(querySection).toContain("'Correct type juice'");
    expect(querySection).not.toContain("'Wrong type juice'");
  });
});
