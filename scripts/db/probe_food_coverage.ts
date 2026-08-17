/**
 * Probe `vietnamese_food_composition` coverage for one or more food names.
 *
 * Answers the question that has to be settled BEFORE curating a food row:
 * does retrieval fail because no row exists, or because a row exists and
 * scores under the JS acceptance floors?
 *
 * The two have opposite fixes. Absent — after checking the English name too,
 * since untranslated USDA rows keep theirs — → insert a curated row (see
 * `supabase/migrations/20260729130000_add_banh_uot_row.sql`). Present but
 * unreachable → curate `name_primary` / `name_alt` so the lexical arm can
 * find it (see `supabase/migrations/20260801120000_curate_broth_search_names.sql`),
 * which also re-queues the row for the embedding backfill.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/db/probe_food_coverage.ts "mì gói" "mì ăn liền"
 *
 * Requires: DATABASE_URL
 */

import postgres from 'postgres';
import {
  FAO_VECTOR_THRESHOLD,
  FUZZY_FALLBACK_THRESHOLD,
  SOURCE_FAO,
  USDA_VECTOR_THRESHOLD,
} from '@/lib/ai/matching/match-constants';
import { encodeDbUrl } from '@/lib/infra/db/client';
import { isMainModule } from '../_lib/runtime';

/** Mirrors `top-k-retrieval.ts`: the SQL arm is deliberately much looser. */
const SQL_FUZZY_THRESHOLD = 0.15;
const PER_SOURCE_LIMIT = 8;

interface FuzzyRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  source_id: number;
  similarity: number;
}

interface ExistingRow {
  id: string;
  source_id: number;
  state: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  carbohydrate_g: string | null;
  embedding_missing: boolean;
}

function acceptanceFloor(sourceId: number): number {
  // The fuzzy arm uses one floor for both sources; the vector arm splits them.
  // Report the STRICTER of the two so a row that clears this is reachable
  // through either arm.
  const vectorFloor =
    sourceId === SOURCE_FAO ? FAO_VECTOR_THRESHOLD : USDA_VECTOR_THRESHOLD;
  return Math.min(vectorFloor, FUZZY_FALLBACK_THRESHOLD);
}

async function probe(sql: postgres.Sql, query: string): Promise<void> {
  console.info(
    `\n─── "${query}" ${'─'.repeat(Math.max(0, 48 - query.length))}`
  );

  const existing = await sql<ExistingRow[]>`
    SELECT id, source_id, state, name_primary, name_alt, name_en,
           carbohydrate_g, (embedding IS NULL) AS embedding_missing
    FROM vietnamese_food_composition
    WHERE name_primary ILIKE ${`%${query}%`}
       OR name_en ILIKE ${`%${query}%`}
       OR EXISTS (
         SELECT 1 FROM unnest(name_alt) AS alt WHERE alt ILIKE ${`%${query}%`}
       )
    ORDER BY source_id, name_primary
    LIMIT 20`;

  console.info(`rows containing the phrase: ${existing.length}`);
  for (const row of existing) {
    const flags = [
      `src=${row.source_id}`,
      row.state,
      `C=${row.carbohydrate_g ?? 'NULL'}`,
      row.embedding_missing ? 'NO-EMBEDDING' : 'embedded',
    ].join(' ');
    console.info(`  ${row.id}  ${row.name_primary}  [${flags}]`);
  }

  const fuzzy = await sql<FuzzyRow[]>`
    SELECT * FROM fuzzy_match_ingredients_all_sources(
      ${query}, ${PER_SOURCE_LIMIT}, ${SQL_FUZZY_THRESHOLD}
    )`;

  console.info(`\nlexical arm at the SQL floor (${SQL_FUZZY_THRESHOLD}):`);
  if (fuzzy.length === 0) {
    console.info('  (nothing — Postgres itself returns no rows)');
  }
  let reachable = 0;
  for (const row of fuzzy) {
    const floor = acceptanceFloor(row.source_id);
    const clears = row.similarity >= floor;
    if (clears) reachable++;
    console.info(
      `  ${clears ? 'PASS' : 'drop'}  ${row.similarity.toFixed(3)} ` +
        `(floor ${floor})  ${row.name_primary}  [${row.id}]`
    );
  }

  console.info(
    reachable > 0
      ? `\n=> REACHABLE: ${reachable} row(s) clear the JS floors lexically.`
      : existing.length > 0
        ? '\n=> PRESENT BUT UNREACHABLE: rows exist, none clear the JS floors.\n' +
          '   Fix by curating name_primary/name_alt, not by lowering thresholds.'
        : '\n=> NO LEXICAL NAME MATCH: no name_primary/name_alt/name_en carries\n' +
          '   this phrase. That is NOT yet proof the food is absent — an\n' +
          '   untranslated USDA row keeps its English name_primary, so re-probe\n' +
          '   the English term and scan the food category before curating.\n' +
          '   Insert a new row only once that search comes back empty too;\n' +
          '   otherwise curate the existing row instead (duplicate rows split\n' +
          '   the retrieval pool and make BOTH harder to reach).'
  );
  console.info(
    '   (The vector arm is not probed here — it needs a live embedding call.\n' +
      '    A lexical PASS is sufficient to prove reachability; a lexical miss\n' +
      '    is not proof of a vector miss.)'
  );
}

async function main(): Promise<void> {
  const queries = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--') && a.trim().length > 0);
  if (queries.length === 0) {
    console.error(
      'Usage: bun --env-file=.env.local scripts/db/probe_food_coverage.ts "mì gói" ...'
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      'Missing DATABASE_URL. Run with:\n' +
        '  bun --env-file=.env.local scripts/db/probe_food_coverage.ts "mì gói"'
    );
    process.exit(1);
  }

  const sql = postgres(encodeDbUrl(process.env.DATABASE_URL), { max: 1 });
  try {
    for (const query of queries) {
      await probe(sql, query);
    }
  } finally {
    await sql.end();
  }
}

if (isMainModule(import.meta)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
