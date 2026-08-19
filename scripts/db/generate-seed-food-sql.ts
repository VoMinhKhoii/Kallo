#!/usr/bin/env bun

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { normalizeIngredientKey } from '@/lib/ai/cache/embedding-cache';
import { isMainModule } from '@/scripts/_lib/runtime';

type CsvRow = Record<string, string>;

const VFC_COLUMNS = [
  'id',
  'name_primary',
  'name_alt',
  'name_en',
  'type_vn',
  'type_en',
  'source_id',
  'state',
  'inedible_portion_pct',
  'calories_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_g',
  'fiber_g',
  'sodium_mg',
  'calcium_mg',
  'iron_mg',
  'magnesium_mg',
  'phosphorus_mg',
  'potassium_mg',
  'zinc_mg',
  'copper_mcg',
  'manganese_mg',
  'beta_carotene_mcg',
  'vitamin_a_mcg',
  'vitamin_d_mcg',
  'vitamin_e_mg',
  'vitamin_k_mcg',
  'vitamin_c_mg',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_pp_mg',
  'vitamin_b5_mg',
  'vitamin_b6_mg',
  'vitamin_b9_mcg',
  'vitamin_b12_mcg',
  'vitamin_h_mcg',
  'last_verified',
  'search_text',
  'search_text_ascii',
  'embedding',
] as const;

const NUMERIC_COLUMNS = new Set([
  'inedible_portion_pct',
  'calories_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_g',
  'fiber_g',
  'sodium_mg',
  'calcium_mg',
  'iron_mg',
  'magnesium_mg',
  'phosphorus_mg',
  'potassium_mg',
  'zinc_mg',
  'copper_mcg',
  'manganese_mg',
  'beta_carotene_mcg',
  'vitamin_a_mcg',
  'vitamin_d_mcg',
  'vitamin_e_mg',
  'vitamin_k_mcg',
  'vitamin_c_mg',
  'vitamin_b1_mg',
  'vitamin_b2_mg',
  'vitamin_pp_mg',
  'vitamin_b5_mg',
  'vitamin_b6_mg',
  'vitamin_b9_mcg',
  'vitamin_b12_mcg',
  'vitamin_h_mcg',
  'source_id',
]);

export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function formatPgVector(values: number[]): string {
  return `'[${values.join(',')}]'`;
}

function parseVectorValue(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length !== 768) return null;
    if (
      !parsed.every(
        (entry) => typeof entry === 'number' && Number.isFinite(entry)
      )
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseTextArray(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[]') return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const values = parsed
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0);
      return values.length > 0 ? values : null;
    }
  } catch {
    // fall through to the simple brace parser below
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return null;
    return inner
      .split(',')
      .map((entry) => entry.trim().replace(/^"|"$/g, ''))
      .filter((entry) => entry.length > 0);
  }

  return [trimmed];
}

export function parseCsv(content: string): CsvRow[] {
  const cleaned = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (ch === '\n') {
      currentRow.push(currentField);
      if (currentRow.some((entry) => entry.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((entry) => entry.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record: CsvRow = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = row[i] ?? '';
    }
    return record;
  });
}

function toSqlText(value: string): string {
  return `'${escapeSqlString(value)}'`;
}

function toSqlNullableText(value: string): string {
  return value.trim().length === 0 ? 'NULL' : toSqlText(value);
}

function toSqlNullableNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'NULL';
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? trimmed : 'NULL';
}

function toVfcSqlValue(column: string, row: CsvRow): string {
  const value = row[column] ?? '';

  if (column === 'name_alt') {
    const parsed = parseTextArray(value);
    if (!parsed || parsed.length === 0) return 'NULL';
    return `ARRAY[${parsed.map((entry) => toSqlText(entry)).join(',')}]`;
  }

  if (column === 'embedding') {
    const parsed = parseVectorValue(value);
    return parsed ? `${formatPgVector(parsed)}::vector(768)` : 'NULL';
  }

  if (NUMERIC_COLUMNS.has(column)) {
    return toSqlNullableNumber(value);
  }

  return toSqlNullableText(value);
}

function buildVfcInsert(rows: CsvRow[]): string {
  const tuples = rows.map((row) => {
    const values = VFC_COLUMNS.map((column) => toVfcSqlValue(column, row));
    return `  (${values.join(', ')})`;
  });

  const updateColumns = VFC_COLUMNS.filter((column) => column !== 'id').map(
    (column) => `${column} = EXCLUDED.${column}`
  );

  return [
    `INSERT INTO vietnamese_food_composition (${VFC_COLUMNS.join(', ')})`,
    'VALUES',
    tuples.join(',\n'),
    'ON CONFLICT (id) DO UPDATE SET',
    `  ${updateColumns.join(',\n  ')}`,
  ].join('\n');
}

function uniqueQueryEmbeddingRows(rows: CsvRow[]): CsvRow[] {
  const uniqueRows: CsvRow[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const key = normalizeIngredientKey(row.name_primary ?? '');
    if (seenKeys.has(key)) continue;

    const embedding = row.embedding ?? '';
    const parsed = parseVectorValue(embedding);
    if (!parsed) continue;

    seenKeys.add(key);
    uniqueRows.push(row);
  }

  return uniqueRows;
}

function buildQueryEmbeddingInsert(rows: CsvRow[]): string | null {
  const tuples = uniqueQueryEmbeddingRows(rows)
    .map((row) => {
      const embedding = row.embedding ?? '';
      const parsed = parseVectorValue(embedding);
      if (!parsed) return null;

      return `  (${toSqlText(normalizeIngredientKey(row.name_primary ?? ''))}, ${toSqlText(row.name_en ?? '')}, ${formatPgVector(parsed)}::vector(768))`;
    })
    .filter((tuple): tuple is string => tuple !== null);

  if (tuples.length === 0) {
    return null;
  }

  return [
    'INSERT INTO ingredient_query_embeddings (name_vi, name_en, embedding)',
    'VALUES',
    tuples.join(',\n'),
    'ON CONFLICT (name_vi) DO UPDATE SET',
    '  name_en = EXCLUDED.name_en,',
    '  embedding = EXCLUDED.embedding',
  ].join('\n');
}

export function buildSeedSql(rows: CsvRow[]): string {
  const statements = ['BEGIN;', buildVfcInsert(rows)];
  const queryEmbeddingInsert = buildQueryEmbeddingInsert(rows);
  if (queryEmbeddingInsert) {
    statements.push(queryEmbeddingInsert);
  }
  statements.push('COMMIT;');
  return `${statements.join('\n\n')}\n`;
}

function parseArgs(argv: string[]): { input?: string; output?: string } {
  const inputIdx = argv.indexOf('--input');
  const outputIdx = argv.indexOf('--output');

  return {
    input: inputIdx >= 0 ? argv[inputIdx + 1] : undefined,
    output: outputIdx >= 0 ? argv[outputIdx + 1] : undefined,
  };
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));

  if (!input || !output) {
    console.error(
      'Usage: bun scripts/db/generate-seed-food-sql.ts --input <csv> --output <sql>'
    );
    process.exit(1);
  }

  const inputPath = resolve(input);
  const outputPath = resolve(output);
  const csv = readFileSync(inputPath, 'utf8');
  const rows = parseCsv(csv);
  const sql = buildSeedSql(rows);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, sql, 'utf8');
  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
}

if (isMainModule(import.meta)) {
  main().catch((error) => {
    console.error('Failed to generate seed SQL:', error);
    process.exit(1);
  });
}
