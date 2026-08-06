/**
 * Phase 3: DB Update — write translations + name_alt per category.
 *
 * Uses set-based UPDATE ... FROM (VALUES ...) for efficiency.
 * Verifies search_text trigger fired after each category.
 */

import { sql } from 'drizzle-orm';
import { loadCheckpoint } from './checkpoints';
import {
  type Checkpoint1,
  type Checkpoint2,
  getDb,
  type NameAltResult,
  resolveInScopeCategories,
} from './shared';

interface Phase3Options {
  dryRun: boolean;
  category?: string;
}

const MAX_NAME_LENGTH = 200;
const MAX_NAME_ALT_ENTRIES = 10;

// The checkpoints are restored from the CI cache and written verbatim into
// prod name_primary/name_alt, so treat them as untrusted input: a truncated or
// hand-edited cache must not corrupt the food table. Rows the DB no longer
// reports as untranslated are already excluded by the query below.
function isValidName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_NAME_LENGTH
  );
}

function validNameAlt(
  entry: NameAltResult | undefined,
  id: string
): string[] | null {
  const alt = entry?.name_alt;
  if (!Array.isArray(alt) || alt.length === 0) return null;
  if (alt.length > MAX_NAME_ALT_ENTRIES || !alt.every(isValidName)) {
    console.warn(`    ⚠ Skipping name_alt for ${id}: invalid checkpoint entry`);
    return null;
  }
  return alt;
}

export async function runPhase3(opts: Phase3Options): Promise<string[]> {
  console.log('\n═══ Phase 3: DB Update (name_primary + name_alt) ═══');

  const cp1 = loadCheckpoint<Checkpoint1>('checkpoint-1.json');
  const cp2 = loadCheckpoint<Checkpoint2>('checkpoint-2.json');

  const cp1Count = Object.keys(cp1).length;
  const cp2Count = Object.keys(cp2).length;
  console.log(
    `  Checkpoint-1: ${cp1Count} translations, Checkpoint-2: ${cp2Count} name_alt entries`
  );

  if (cp1Count === 0) {
    console.log('  ⚠ No translations found. Run Phase 1 first.');
    return [];
  }

  const db = getDb();

  // Get category mapping for items
  const categoryFilter = opts.category
    ? [opts.category]
    : await resolveInScopeCategories();

  // An empty scope means every row is already translated. Interpolating it
  // would emit `type_en IN ()` — a syntax error — so stop here instead.
  if (categoryFilter.length === 0) {
    console.log('  ✓ Phase 3 complete (nothing left untranslated)');
    return [];
  }

  const catPlaceholders = categoryFilter
    .map((c) => `'${c.replace(/'/g, "''")}'`)
    .join(',');

  const rows = (await db.execute(
    sql.raw(`
      SELECT id, type_en
      FROM vietnamese_food_composition
      WHERE source_id = 2
        AND type_en IN (${catPlaceholders})
        AND name_primary = name_en
      ORDER BY type_en, id
    `)
  )) as unknown as { id: string; type_en: string }[];

  // Only update items that have a VALID Phase 1 translation AND are still
  // untranslated in DB
  const updateable = rows.filter((r) => {
    if (!cp1[r.id]) return false;
    if (!isValidName(cp1[r.id].name_primary_vi)) {
      console.warn(`    ⚠ Skipping ${r.id}: invalid checkpoint translation`);
      return false;
    }
    return true;
  });

  if (updateable.length === 0) {
    console.log(
      '  ✓ Nothing to update (all items already applied or no checkpoint data)'
    );
    return [];
  }

  // Group by category
  const byCategory = new Map<string, string[]>();
  for (const row of updateable) {
    const list = byCategory.get(row.type_en) || [];
    list.push(row.id);
    byCategory.set(row.type_en, list);
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] Would update ${updateable.length} items across ${byCategory.size} categories:`
    );
    for (const [cat, ids] of byCategory) {
      const withAlt = ids.filter((id) => cp2[id]).length;
      console.log(`    ${cat}: ${ids.length} items (${withAlt} with name_alt)`);
    }
    return [];
  }

  const allUpdatedIds: string[] = [];

  for (const [category, ids] of byCategory) {
    console.log(`\n  📂 ${category}: updating ${ids.length} items...`);

    // Build VALUES clause for set-based update
    const valueRows = ids.map((id) => {
      const namePrimary = cp1[id].name_primary_vi.replace(/'/g, "''");
      const alt = validNameAlt(cp2[id], id);
      // NULL must carry the array type: a chunk whose rows are ALL null would
      // otherwise leave the VALUES column inferred as text, and the UPDATE
      // fails with `column "name_alt" is of type text[] but expression is of
      // type text`.
      const nameAlt = alt
        ? `ARRAY[${alt.map((a) => `'${a.replace(/'/g, "''")}'`).join(',')}]`
        : 'NULL::text[]';
      const safeId = id.replace(/'/g, "''");
      return `('${safeId}', '${namePrimary}', ${nameAlt})`;
    });

    // Process in chunks of 200 to avoid oversized queries
    const CHUNK_SIZE = 200;
    for (let i = 0; i < valueRows.length; i += CHUNK_SIZE) {
      const chunk = valueRows.slice(i, i + CHUNK_SIZE);
      const chunkIds = ids.slice(i, i + CHUNK_SIZE);

      // embedding = NULL is what makes an interrupted run recoverable: a row
      // rewritten here leaves the untranslated predicate immediately, so if
      // the process dies before Phase 4 the only durable marker that its
      // (English-text) embedding is stale is the NULL — which Phase 4's
      // `embedding IS NULL` scope and the workflow's verify step both see.
      await db.execute(
        sql.raw(`
          UPDATE vietnamese_food_composition AS vfc
          SET name_primary = data.name_primary_vi,
              name_alt = data.name_alt_arr,
              embedding = NULL
          FROM (VALUES ${chunk.join(',')}) AS data(id, name_primary_vi, name_alt_arr)
          WHERE vfc.id = data.id
        `)
      );

      allUpdatedIds.push(...chunkIds);
    }

    // Verify trigger rebuilt search_text for one item
    const sampleId = ids[0].replace(/'/g, "''");
    const [sample] = (await db.execute(
      sql.raw(
        `SELECT id, search_text FROM vietnamese_food_composition WHERE id = '${sampleId}'`
      )
    )) as unknown as { id: string; search_text: string }[];

    if (
      sample?.search_text?.includes(cp1[ids[0]].name_primary_vi.slice(0, 20))
    ) {
      console.log(`    ✓ Verified: search_text rebuilt (sample: ${sample.id})`);
    } else {
      console.warn(
        `    ⚠ search_text may not have been rebuilt for ${sample?.id}`
      );
    }

    const withAlt = ids.filter((id) => cp2[id]).length;
    console.log(`    Updated: ${ids.length} name_primary, ${withAlt} name_alt`);
  }

  console.log(
    `\n  ✓ Phase 3 complete: ${allUpdatedIds.length} items updated across ${byCategory.size} categories`
  );
  return allUpdatedIds;
}
