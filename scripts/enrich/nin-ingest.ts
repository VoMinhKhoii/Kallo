#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { writeCsv, writeJson } from './nin-artifacts';
import {
  atwaterResult,
  classify,
  constructRows,
  dedupeClones,
  normalizeRows,
  snapshotSha256,
} from './nin-core';
import { applyRows, runEmbeddingBackfill } from './nin-db';
import { buildDbNameIndex, findDuplicate } from './nin-duplicates';
import { measureRetrieval } from './nin-measure';
import { type DbNameRow, snapshotSchema } from './nin-types';

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return resolve(value);
}

function parseDbNames(path: string): DbNameRow[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [id, namePrimary = '', alts = ''] = line.split('\t');
      return {
        id,
        namePrimary,
        nameAlt: alts.split('|').filter(Boolean),
        source: id.startsWith('fao_vn_2007_')
          ? 'fao'
          : id.startsWith('usda_')
            ? 'usda'
            : 'other',
      };
    });
}

async function main(): Promise<void> {
  const inputPath = requiredOption('--input');
  const dbNamesPath = requiredOption('--db-names');
  const outDir = resolve(option('--out', 'scripts/enrich/out')!);
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

  const dbNames = parseDbNames(dbNamesPath);
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
    constructed: constructed.length,
  };
  const manifest = {
    snapshot: {
      sha256: snapshotSha256(rawInput),
      pullDate: '2026-08-12',
      path: relative(process.cwd(), inputPath),
    },
    counts,
    micronutrientsIngested: false,
    waterInArtifactOnly: true,
    aliasGaps: [
      'No composition-safe plain cooked xôi carrier exists in NIN.',
      'No cooked mung-bean row exists in NIN.',
      'No hành phi row exists in NIN.',
    ],
  };
  writeJson(outDir, 'manifest.json', manifest);
  console.log(JSON.stringify(manifest, null, 2));

  let insertedIds: string[] = [];
  if (process.argv.includes('--apply')) {
    insertedIds = await applyRows(constructed);
    writeJson(outDir, 'inserted-ids.json', insertedIds);
    console.log(`Inserted ${insertedIds.length} rows in one transaction.`);
  }
  if (process.argv.includes('--embed')) {
    if (insertedIds.length === 0) {
      insertedIds = JSON.parse(
        readFileSync(resolve(outDir, 'inserted-ids.json'), 'utf8')
      );
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
