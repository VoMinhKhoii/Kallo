#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { writeCsv, writeJson } from './nin-artifacts';
import {
  atwaterResult,
  classify,
  constructRows,
  dedupeClones,
  normalizeRows,
  snapshotSha256,
} from './nin-core';
import {
  buildDbNameIndex,
  findDuplicate,
  parseDbNames,
} from './nin-duplicates';
import { NIN_MIGRATION_PATH, renderNinMigration } from './nin-migration';
import {
  insertedIdsSchema,
  NIN_SNAPSHOT_DATE,
  snapshotSchema,
} from './nin-types';
import { applyRows, runEmbeddingBackfill } from './runtime/nin-db';
import { measureRetrieval } from './runtime/nin-measure';

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return resolve(value);
}

async function main(): Promise<void> {
  const inputPath = requiredOption('--input');
  const dbNamesPath = requiredOption('--db-names');
  const outDir = resolve(option('--out') ?? 'scripts/enrich/out');
  const rawInput = readFileSync(inputPath, 'utf8');
  const sourceRows = snapshotSchema.parse(JSON.parse(rawInput));

  const normalized = normalizeRows(sourceRows);
  writeJson(outDir, '01-normalized.json', normalized);

  const quarantine = normalized
    .map((row) => ({ row, result: atwaterResult(row) }))
    .filter(({ result }) => result.reasons.length > 0);
  const quarantinedCodes = new Set(quarantine.map(({ row }) => row.code));
  const afterQuarantine = normalized.filter(
    (row) => !quarantinedCodes.has(row.code)
  );
  writeCsv(
    outDir,
    'quarantine.csv',
    [
      'code',
      'name',
      'stated_kcal',
      'computed_kcal',
      'relative_error',
      'reasons',
    ],
    quarantine.map(({ row, result }) => [
      row.code,
      row.name_vi,
      row.energy,
      result.computed.toFixed(2),
      result.relativeError.toFixed(4),
      result.reasons.join('|'),
    ])
  );

  const cloneResult = dedupeClones(afterQuarantine);
  writeCsv(
    outDir,
    'clones.csv',
    ['group', 'kept_code', 'kept_name', 'dropped_code', 'dropped_name'],
    cloneResult.groups.flatMap((group) =>
      group.dropped.map((row) => [
        group.group,
        group.kept.code,
        group.kept.name_vi,
        row.code,
        row.name_vi,
      ])
    )
  );

  const labelled = cloneResult.kept.map((row) => ({ row, ...classify(row) }));
  writeCsv(
    outDir,
    'labels.csv',
    ['code', 'name', 'label', 'kcal', 'protein_g', 'reason'],
    labelled.map(({ row, label, reason }) => [
      row.code,
      row.name_vi,
      label,
      row.energy,
      row.protein,
      reason,
    ])
  );
  const afterDishExclusion = labelled
    .filter(({ label }) => label !== 'bowl')
    .map(({ row }) => row);

  const dbNames = parseDbNames(readFileSync(dbNamesPath, 'utf8'));
  const dbNameIndex = buildDbNameIndex(dbNames);
  const duplicateResults = afterDishExclusion.map((row) => ({
    row,
    ...findDuplicate(row, dbNameIndex),
  }));
  writeCsv(
    outDir,
    'dups.csv',
    [
      'code',
      'name',
      'verdict',
      'match_basis',
      'db_id',
      'db_name',
      'matched_name',
    ],
    duplicateResults.map(({ row, verdict, match, matchedName, matchBasis }) => [
      row.code,
      row.name_vi,
      verdict,
      matchBasis,
      match?.id,
      match?.namePrimary,
      matchedName,
    ])
  );
  const survivors = duplicateResults
    .filter(({ verdict }) => verdict !== 'duplicate-vietnamese')
    .map(({ row }) => row);
  const constructed = constructRows(survivors);
  writeJson(outDir, '06-rows.json', constructed);

  const counts = {
    loaded: sourceRows.length,
    normalized: normalized.length,
    quarantined: quarantine.length,
    afterQuarantine: afterQuarantine.length,
    cloneGroups: cloneResult.groups.length,
    cloneRowsDropped: cloneResult.groups.reduce(
      (sum, group) => sum + group.dropped.length,
      0
    ),
    afterClones: cloneResult.kept.length,
    bowlsExcluded: labelled.filter(({ label }) => label === 'bowl').length,
    afterDishExclusion: afterDishExclusion.length,
    vietnameseDuplicates: duplicateResults.filter(
      ({ verdict }) => verdict === 'duplicate-vietnamese'
    ).length,
    usdaOnlyEquivalentsKept: duplicateResults.filter(
      ({ verdict }) => verdict === 'keep-usda-only'
    ).length,
    zeroKcalCorrections: normalized.filter(
      (row, index) => row.energy !== sourceRows[index]?.energy
    ).length,
    constructed: constructed.length,
  };
  const manifest = {
    snapshot: {
      sha256: snapshotSha256(rawInput),
      pullDate: NIN_SNAPSHOT_DATE,
      path: `scripts/enrich/input/${basename(inputPath)}`,
    },
    counts,
    micronutrientsIngested: false,
    waterInArtifactOnly: true,
    aliasDecisions: [
      'Plain xôi pre-match rewrites to xôi trắng on usda_20055_cooked.',
      'Cooked mung bean uses unsalted usda_16081_cooked; plain đậu xanh stays state-ambiguous.',
      'Hành phi is deferred pending a verified fried-shallot composition row.',
    ],
  };
  writeJson(outDir, 'manifest.json', manifest);
  console.log(JSON.stringify(manifest, null, 2));

  if (process.argv.includes('--emit-migration')) {
    const migrationPath = resolve(NIN_MIGRATION_PATH);
    writeFileSync(
      migrationPath,
      renderNinMigration(constructed, {
        snapshotSha256: manifest.snapshot.sha256,
        pullDate: manifest.snapshot.pullDate,
        counts,
      })
    );
    console.log(`Wrote ${relative(process.cwd(), migrationPath)}.`);
  }

  let insertedIds: string[] = [];
  const reapply = process.argv.includes('--reapply');
  if (process.argv.includes('--apply') || reapply) {
    insertedIds = await applyRows(constructed, { reapply });
    writeJson(outDir, 'inserted-ids.json', insertedIds);
    console.log(
      `${reapply ? 'Reapplied' : 'Inserted'} ${insertedIds.length} rows in one transaction.`
    );
    if (reapply && !process.argv.includes('--embed')) {
      console.log(
        'Embedding input excludes state, but --reapply deletes stored vectors; rerun with --embed.'
      );
    }
  }
  if (process.argv.includes('--embed')) {
    if (insertedIds.length === 0) {
      const insertedIdsPath = resolve(outDir, 'inserted-ids.json');
      insertedIds = existsSync(insertedIdsPath)
        ? insertedIdsSchema.parse(
            JSON.parse(readFileSync(insertedIdsPath, 'utf8'))
          )
        : constructed.map((row) => row.id);
    }
    await runEmbeddingBackfill(insertedIds);
  }
  const measurementLabel = option('--measure');
  if (measurementLabel) {
    const report = requiredOption('--retrieval-report');
    writeJson(
      outDir,
      `measurement-${measurementLabel}.json`,
      await measureRetrieval(report)
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
