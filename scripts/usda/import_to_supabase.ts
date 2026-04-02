#!/usr/bin/env bun
/**
 * Import USDA SR Legacy CSV into the vietnamese_food_composition table.
 *
 * Reads the CSV produced by download_usda_sr.py and batch-inserts rows
 * into Supabase. Existing IDs are skipped (ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   bun --env-file=.env.local scripts/usda/import_to_supabase.ts --csv data/usda_sr/usda_sr_legacy.csv
 *   bun --env-file=.env.local scripts/usda/import_to_supabase.ts --csv data/usda_sr/usda_sr_legacy.csv --dry-run
 *
 * Requires env var: DATABASE_URL
 */

import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/db';
import { vietnameseFoodComposition } from '@/lib/db/schema';

const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const csvIdx = args.indexOf('--csv');
const dryRun = args.includes('--dry-run');

if (csvIdx === -1 || !args[csvIdx + 1]) {
  console.error(
    'Usage: bun --env-file=.env.local scripts/usda/import_to_supabase.ts --csv <path>'
  );
  process.exit(1);
}

const csvPath = args[csvIdx + 1];

if (!dryRun && !process.env.DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL. Run with:\n  bun --env-file=.env.local scripts/usda/import_to_supabase.ts --csv <path>'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV parsing (simple — no external deps needed for this format)
// ---------------------------------------------------------------------------

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? '';
    }
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Row conversion
// ---------------------------------------------------------------------------

function numOrNull(val: string): string | null {
  if (val === '' || val === 'None' || val === 'null') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : String(n);
}

interface FoodRow {
  id: string;
  namePrimary: string;
  nameAlt: string[] | null;
  nameEn: string;
  typeVn: string;
  typeEn: string;
  sourceId: number;
  state: string;
  inediblePortionPct: string | null;
  caloriesKcal: string | null;
  proteinG: string | null;
  carbohydrateG: string | null;
  fatG: string | null;
  fiberG: string | null;
  sodiumMg: string | null;
  calciumMg: string | null;
  ironMg: string | null;
  magnesiumMg: string | null;
  phosphorusMg: string | null;
  potassiumMg: string | null;
  zincMg: string | null;
  copperMcg: string | null;
  manganeseMg: string | null;
  betaCaroteneMcg: string | null;
  vitaminAMcg: string | null;
  vitaminDMcg: string | null;
  vitaminEMg: string | null;
  vitaminKMcg: string | null;
  vitaminCMg: string | null;
  vitaminB1Mg: string | null;
  vitaminB2Mg: string | null;
  vitaminPpMg: string | null;
  vitaminB5Mg: string | null;
  vitaminB6Mg: string | null;
  vitaminB9Mcg: string | null;
  vitaminB12Mcg: string | null;
  vitaminHMcg: string | null;
  lastVerified: string | null;
}

function csvRowToInsert(row: Record<string, string>): FoodRow {
  // Parse name_alt from PostgreSQL array literal or empty
  let nameAlt: string[] | null = null;
  if (row.name_alt && row.name_alt !== '{}') {
    // Handle PostgreSQL-style array: {val1,val2}
    const inner = row.name_alt.replace(/^\{|\}$/g, '');
    if (inner) {
      nameAlt = inner.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    }
  }

  return {
    id: row.id,
    namePrimary: row.name_primary,
    nameAlt,
    nameEn: row.name_en,
    typeVn: row.type_vn,
    typeEn: row.type_en,
    sourceId: Number(row.source_id) || 2, // 2 = USDA_SR
    state: row.state,
    inediblePortionPct: numOrNull(row.inedible_portion_pct),
    caloriesKcal: numOrNull(row.calories_kcal),
    proteinG: numOrNull(row.protein_g),
    carbohydrateG: numOrNull(row.carbohydrate_g),
    fatG: numOrNull(row.fat_g),
    fiberG: numOrNull(row.fiber_g),
    sodiumMg: numOrNull(row.sodium_mg),
    calciumMg: numOrNull(row.calcium_mg),
    ironMg: numOrNull(row.iron_mg),
    magnesiumMg: numOrNull(row.magnesium_mg),
    phosphorusMg: numOrNull(row.phosphorus_mg),
    potassiumMg: numOrNull(row.potassium_mg),
    zincMg: numOrNull(row.zinc_mg),
    copperMcg: numOrNull(row.copper_mcg),
    manganeseMg: numOrNull(row.manganese_mg),
    betaCaroteneMcg: numOrNull(row.beta_carotene_mcg),
    vitaminAMcg: numOrNull(row.vitamin_a_mcg),
    vitaminDMcg: numOrNull(row.vitamin_d_mcg),
    vitaminEMg: numOrNull(row.vitamin_e_mg),
    vitaminKMcg: numOrNull(row.vitamin_k_mcg),
    vitaminCMg: numOrNull(row.vitamin_c_mg),
    vitaminB1Mg: numOrNull(row.vitamin_b1_mg),
    vitaminB2Mg: numOrNull(row.vitamin_b2_mg),
    vitaminPpMg: numOrNull(row.vitamin_pp_mg),
    vitaminB5Mg: numOrNull(row.vitamin_b5_mg),
    vitaminB6Mg: numOrNull(row.vitamin_b6_mg),
    vitaminB9Mcg: numOrNull(row.vitamin_b9_mcg),
    vitaminB12Mcg: numOrNull(row.vitamin_b12_mcg),
    vitaminHMcg: numOrNull(row.vitamin_h_mcg),
    lastVerified: row.last_verified || null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('USDA SR Legacy → Supabase Import');
  console.log('='.repeat(60));

  // Read and parse CSV
  console.log(`\n📂 Reading ${csvPath}...`);
  const content = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`  ✓ Parsed ${rows.length} rows`);

  if (rows.length === 0) {
    console.error('No rows found in CSV');
    process.exit(1);
  }

  // Validate first row
  const sample = rows[0];
  if (!sample.id || !sample.name_primary || !sample.source_id) {
    console.error(
      'CSV does not have expected columns. Got:',
      Object.keys(sample).join(', ')
    );
    process.exit(1);
  }

  // Convert all rows
  const insertRows = rows.map(csvRowToInsert);

  if (dryRun) {
    console.log('\n🔍 [dry-run] First 3 rows:');
    for (const row of insertRows.slice(0, 3)) {
      console.log(JSON.stringify(row, null, 2));
    }
    console.log(`\n[dry-run] Would insert ${insertRows.length} rows. Exiting.`);
    process.exit(0);
  }

  // Connect to database
  console.log('\n🔌 Connecting to database...');
  const client = postgres(encodeDbUrl(process.env.DATABASE_URL!));
  const db = drizzle(client);

  // Count existing rows
  const [{ count: existingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vietnameseFoodComposition);
  console.log(`  ✓ Connected. Current row count: ${existingCount}`);

  // Batch insert
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const totalBatches = Math.ceil(insertRows.length / BATCH_SIZE);

  console.log(
    `\n📥 Inserting ${insertRows.length} rows in ${totalBatches} batches of ${BATCH_SIZE}...`
  );

  for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
    const batch = insertRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      // Count before insert to determine how many were actually inserted
      const [{ count: beforeCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vietnameseFoodComposition);

      await db
        .insert(vietnameseFoodComposition)
        .values(batch)
        .onConflictDoNothing({ target: vietnameseFoodComposition.id });

      const [{ count: afterCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vietnameseFoodComposition);

      const batchInserted = afterCount - beforeCount;
      const batchSkipped = batch.length - batchInserted;
      inserted += batchInserted;
      skipped += batchSkipped;

      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(
          `  Batch ${batchNum}/${totalBatches}: +${batchInserted} inserted, ${batchSkipped} skipped`
        );
      }
    } catch (e) {
      errors += batch.length;
      console.error(
        `  ✗ Batch ${batchNum} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  // Final count
  const [{ count: finalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vietnameseFoodComposition);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Import complete!');
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (existing): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   DB rows before: ${existingCount}`);
  console.log(`   DB rows after:  ${finalCount}`);
  console.log('='.repeat(60));

  await client.end();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
