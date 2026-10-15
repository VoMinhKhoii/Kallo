/**
 * The build-and-publish flow, with its database and storage passed in so the
 * reuse, force, race and ordering rules are testable without either.
 *
 *   1. Fingerprint the card data and hash it with the spec into a key. A
 *      published build for that key is reused (unless forced).
 *   2. Read one snapshot, build the index, run the parity gate. A failure
 *      publishes nothing.
 *   3. Upload the files as immutable objects, manifest last, then point
 *      f<format>/by-key/<key>.json at the build: create it when absent, or
 *      (forced) replace exactly the version read in step 1.
 *
 * Every query runs inside an explicit READ ONLY transaction: the session's
 * default is not relied on (Supabase's pooler may drop startup settings).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { buildIndex, FILE_NAMES, writeArtifactFiles } from './artifact-files';
import type { ReadOnlySql } from './connect';
import { readFingerprint } from './fingerprint';
import type { createImmutable, download, upload } from './gcs';
import { checkParity, sampleQueries } from './parity';
import { readSnapshot } from './snapshot';
import { ARTIFACT_FORMAT, artifactKey, buildSpec } from './spec';

export interface Storage {
  download: typeof download;
  upload: typeof upload;
  createImmutable: typeof createImmutable;
}

export interface BuildDeps {
  sql: ReadOnlySql;
  storage: Storage;
  gitSha: string | null;
  now: () => Date;
  log: (message: string, detail?: unknown) => void;
}

export interface BuildOptions {
  bucket: string | null;
  force: boolean;
  dryRun: boolean;
  outDir: string;
}

export type BuildResult =
  | { kind: 'reused' | 'published'; uri: string }
  | { kind: 'dry-run'; buildId: string };

const PREFIX = `f${ARTIFACT_FORMAT}`;

const PointerSchema = z.object({
  buildId: z.string().min(1),
  uri: z.string().min(1),
  key: z.string().min(1),
});
type Pointer = z.infer<typeof PointerSchema>;

/** The key's pointer and its generation ('0' = absent), validated. */
async function readPointer(
  storage: Storage,
  bucket: string,
  key: string
): Promise<{ pointer: Pointer | null; generation: string }> {
  const name = `${PREFIX}/by-key/${key}.json`;
  const found = await storage.download(bucket, name);
  if (!found) return { pointer: null, generation: '0' };
  const pointer = PointerSchema.parse(JSON.parse(found.body.toString('utf8')));
  const expectedUri = `gs://${bucket}/${PREFIX}/${pointer.buildId}`;
  if (pointer.key !== key || pointer.uri !== expectedUri) {
    throw new Error(
      `${name} names key ${pointer.key} and ${pointer.uri}; expected ${key} and ${expectedUri}`
    );
  }
  return { pointer, generation: found.generation };
}

export async function runBuild(
  deps: BuildDeps,
  opts: BuildOptions
): Promise<BuildResult> {
  const { sql, storage, log } = deps;
  const t0 = deps.now().getTime();
  const elapsed = () => `${((deps.now().getTime() - t0) / 1000).toFixed(1)}s`;

  const spec = buildSpec();
  const fingerprint = await sql.begin('read only', (tx) => readFingerprint(tx));
  const key = artifactKey(fingerprint, spec);
  log(`key ${key} (${elapsed()})`, fingerprint);

  // A dry run always builds and gates; it never reuses or publishes.
  const existing =
    opts.bucket && !opts.dryRun
      ? await readPointer(storage, opts.bucket, key)
      : { pointer: null, generation: '0' };
  if (existing.pointer && !opts.force) {
    log(`up to date: ${existing.pointer.buildId}`);
    return { kind: 'reused', uri: existing.pointer.uri };
  }

  const snapshot = await readSnapshot(sql);
  if (!isDeepStrictEqual(snapshot.fingerprint, fingerprint)) {
    throw new Error('card data changed while building; run the build again');
  }
  log(
    `snapshot: ${snapshot.catalogRows.length} catalog rows, ${snapshot.textIds.length} strings (${elapsed()})`
  );
  const built = buildIndex(snapshot.texts);
  log(`index built (${elapsed()})`);

  const parity = await sql.begin('read only', async (tx) => {
    const queries = await sampleQueries(tx, snapshot.texts);
    return checkParity(
      tx,
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
  });
  log('parity', parity);
  if (!parity.passed) throw new Error('parity gate failed; nothing published');

  const stamp = deps.now().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const buildId = `${key.slice(0, 12)}-${stamp}Z`;
  mkdirSync(opts.outDir, { recursive: true });
  const manifest = writeArtifactFiles({
    outDir: opts.outDir,
    snapshot,
    index: built.index,
    spec,
    key,
    buildId,
    gitSha: deps.gitSha,
  });
  log(`wrote ${buildId} to ${opts.outDir}`, manifest.counts);
  if (!opts.bucket || opts.dryRun) return { kind: 'dry-run', buildId };

  const bucket = opts.bucket;
  for (const name of [...FILE_NAMES, 'manifest.json']) {
    await storage.createImmutable(
      bucket,
      `${PREFIX}/${buildId}/${name}`,
      readFileSync(join(opts.outDir, name)),
      name.endsWith('.json') ? 'application/json' : undefined
    );
  }
  const uri = `gs://${bucket}/${PREFIX}/${buildId}`;
  const body = Buffer.from(JSON.stringify({ buildId, uri, key }));
  const pointerName = `${PREFIX}/by-key/${key}.json`;
  let generation = opts.force ? existing.generation : '0';
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (
      await storage.upload(
        bucket,
        pointerName,
        body,
        generation,
        'application/json'
      )
    ) {
      log(`published (${elapsed()})`);
      return { kind: 'published', uri };
    }
    // Precondition failed: another build created or replaced the pointer, or
    // our own write landed and its response was lost. Without --force the
    // pointer's build serves this key; with --force, replace it once more
    // unless it is already ours.
    const now = await readPointer(storage, bucket, key);
    if (now.pointer && (!opts.force || now.pointer.buildId === buildId)) {
      log(`pointer already names ${now.pointer.buildId}`);
      return { kind: 'published', uri: now.pointer.uri };
    }
    generation = now.generation;
  }
  throw new Error(`could not update ${pointerName}`);
}
