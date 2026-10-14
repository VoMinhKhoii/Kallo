/**
 * Builds and publishes the card search artifact the containers load (the
 * catalog plus a vector index, so matching needs no database search). Run by
 * the prod deploy after the card-embedding backfill.
 *
 *   1. Fingerprint the card data in Postgres and hash it with the spec
 *      (`spec.ts`) into a key. A published build for that key is reused.
 *   2. Otherwise read a consistent snapshot, build the index, and run the
 *      parity gate (`parity.ts`); a failure publishes nothing.
 *   3. Upload the files as immutable objects under f<format>/<buildId>/,
 *      manifest last, then point f<format>/by-key/<key>.json at the build.
 *
 * Usage:
 *   bun scripts/data/food-cards/search-artifact/build-search-artifact.ts \
 *     --bucket <bucket> [--force] [--dry-run] [--out <dir>]
 *
 * --force rebuilds even when the key has a build and repoints the key at the
 * new one (needed after re-embedding strings under unchanged ids).
 * --dry-run builds and gates without uploading (no bucket needed).
 *
 * Env: DATABASE_URL (read only), optional GCS_ACCESS_TOKEN, GITHUB_SHA.
 * Prints CARD_INDEX_URI=gs://<bucket>/f<format>/<buildId> and appends it to
 * $GITHUB_ENV when set.
 */
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { buildIndex, FILE_NAMES, writeArtifactFiles } from './artifact-files';
import { connect } from './connect';
import { readFingerprint } from './fingerprint';
import { createImmutable, download, upload } from './gcs';
import { checkParity, sampleQueries } from './parity';
import { readSnapshot } from './snapshot';
import { ARTIFACT_FORMAT, artifactKey, buildSpec } from './spec';

const { values: args } = parseArgs({
  options: {
    bucket: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (!args.bucket && !args['dry-run']) throw new Error('--bucket is required');

const prefix = `f${ARTIFACT_FORMAT}`;
const elapsed = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

interface Pointer {
  buildId: string;
  uri: string;
  key: string;
}

function publishUri(uri: string) {
  console.log(`CARD_INDEX_URI=${uri}`);
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `CARD_INDEX_URI=${uri}\n`);
  }
}

async function readPointer(bucket: string, name: string) {
  const found = await download(bucket, name);
  if (!found) return { pointer: null, generation: '0' };
  return {
    pointer: JSON.parse(found.body.toString('utf8')) as Pointer,
    generation: found.generation,
  };
}

const sql = connect(databaseUrl);
try {
  const t0 = Date.now();
  const spec = buildSpec();
  const fingerprint = await sql.begin('read only', (tx) => readFingerprint(tx));
  const key = artifactKey(fingerprint, spec);
  const pointerName = `${prefix}/by-key/${key}.json`;
  console.info(`[card-artifact] key ${key} (${elapsed(t0)})`, fingerprint);

  const existing = args.bucket
    ? await readPointer(args.bucket, pointerName)
    : { pointer: null, generation: '0' };
  if (existing.pointer && !args.force) {
    console.info(`[card-artifact] up to date: ${existing.pointer.buildId}`);
    publishUri(existing.pointer.uri);
  } else {
    const snapshot = await readSnapshot(sql);
    if (!isDeepStrictEqual(snapshot.fingerprint, fingerprint)) {
      throw new Error('card data changed while building; run the build again');
    }
    console.info(
      `[card-artifact] snapshot: ${snapshot.catalogRows.length} catalog rows, ${snapshot.textIds.length} strings (${elapsed(t0)})`
    );
    const built = buildIndex(snapshot.texts);
    console.info(`[card-artifact] index built (${elapsed(t0)})`);

    const queries = await sampleQueries(sql, snapshot.texts);
    const parity = await checkParity(
      sql,
      {
        store: {
          texts: snapshot.texts,
          norms: built.norms,
          textRows: snapshot.textRows,
        },
        prefixes: built.prefixes,
        count: built.count,
        index: built.index,
      },
      queries
    );
    console.info('[card-artifact] parity', parity);
    if (!parity.passed)
      throw new Error('parity gate failed; nothing published');

    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const buildId = `${key.slice(0, 12)}-${stamp}Z`;
    const outDir = args.out ?? mkdtempSync(join(tmpdir(), 'card-artifact-'));
    const manifest = writeArtifactFiles({
      outDir,
      snapshot,
      index: built.index,
      spec,
      key,
      buildId,
      gitSha: process.env.GITHUB_SHA ?? null,
    });
    console.info(
      `[card-artifact] wrote ${buildId} to ${outDir}`,
      manifest.counts
    );

    if (args.bucket && !args['dry-run']) {
      const bucket = args.bucket;
      for (const name of [...FILE_NAMES, 'manifest.json']) {
        await createImmutable(
          bucket,
          `${prefix}/${buildId}/${name}`,
          readFileSync(join(outDir, name)),
          name.endsWith('.json') ? 'application/json' : undefined
        );
      }
      const uri = `gs://${bucket}/${prefix}/${buildId}`;
      const pointer: Pointer = { buildId, uri, key };
      const body = Buffer.from(JSON.stringify(pointer));
      let generation = args.force ? existing.generation : '0';
      for (let attempt = 1; ; attempt++) {
        if (
          await upload(
            bucket,
            pointerName,
            body,
            generation,
            'application/json'
          )
        ) {
          publishUri(uri);
          break;
        }
        // Lost a race. Without --force, the other build serves this key; with
        // --force, re-read and replace once more unless it is already ours.
        const now = await readPointer(bucket, pointerName);
        if (now.pointer && (!args.force || now.pointer.buildId === buildId)) {
          publishUri(now.pointer.uri);
          break;
        }
        if (attempt >= 2) throw new Error(`could not update ${pointerName}`);
        generation = now.generation;
      }
      console.info(`[card-artifact] published (${elapsed(t0)})`);
    }
  }
} finally {
  await sql.end();
}
