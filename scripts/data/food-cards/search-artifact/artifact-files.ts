/**
 * The artifact's files, written to a local directory before upload:
 *
 *   catalog.json     the catalog query's rows (the runtime builds its lexical
 *                    and BM25 indexes from them, with the same code as today)
 *   texts.f16        linked strings' vectors, count × 768 little-endian binary16
 *   text-rows.json   for each string (same order), the food rows it names
 *   index.usearch    HNSW over the strings' unit-length 256-dim prefixes,
 *                    keys = string positions (`INDEX_PARAMS`)
 *   manifest.json    identity, spec, fingerprint, counts, and every file's
 *                    sha256 and size — written last, uploaded last
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Index, type IndexConfig } from 'usearch';
import {
  INDEX_PARAMS,
  prepareTexts,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import type { Snapshot } from './snapshot';
import type { ArtifactSpec } from './spec';

export const FILE_NAMES = [
  'catalog.json',
  'texts.f16',
  'text-rows.json',
  'index.usearch',
] as const;

export interface FileEntry {
  sha256: string;
  bytes: number;
}

export interface Manifest {
  format: number;
  buildId: string;
  key: string;
  createdAt: string;
  gitSha: string | null;
  spec: ArtifactSpec;
  fingerprint: Snapshot['fingerprint'];
  counts: { catalogRows: number; texts: number; links: number };
  files: Record<(typeof FILE_NAMES)[number], FileEntry>;
}

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * The index and the prepared vectors, kept for the parity gate. Built on one
 * thread: a multi-threaded build inserts in a different order each run, so
 * the same data would give a different graph (and parity result) per deploy;
 * one thread gives byte-identical indexes (~6 s for 58k strings on a laptop).
 */
export function buildIndex(texts: Uint16Array) {
  const prepared = prepareTexts(texts);
  const index = new Index(INDEX_PARAMS as unknown as IndexConfig);
  const keys = new BigUint64Array(prepared.count);
  for (let i = 0; i < prepared.count; i++) keys[i] = BigInt(i);
  index.add(keys, prepared.prefixes, 1);
  return { index, ...prepared };
}

export function writeArtifactFiles(args: {
  outDir: string;
  snapshot: Snapshot;
  index: Index;
  spec: ArtifactSpec;
  key: string;
  buildId: string;
  gitSha: string | null;
}): Manifest {
  const { outDir, snapshot } = args;
  const write = (name: string, bytes: Uint8Array) => {
    writeFileSync(join(outDir, name), bytes);
    return { sha256: sha256(bytes), bytes: bytes.byteLength };
  };
  const json = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8');
  const texts = Buffer.from(
    snapshot.texts.buffer,
    snapshot.texts.byteOffset,
    snapshot.texts.byteLength
  );
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
    throw new Error('texts.f16 is little-endian; this host is not');
  }
  const indexPath = join(outDir, 'index.usearch');
  args.index.save(indexPath);

  const manifest: Manifest = {
    format: args.spec.format,
    buildId: args.buildId,
    key: args.key,
    createdAt: new Date().toISOString(),
    gitSha: args.gitSha,
    spec: args.spec,
    fingerprint: snapshot.fingerprint,
    counts: {
      catalogRows: snapshot.catalogRows.length,
      texts: snapshot.textIds.length,
      links: snapshot.textRows.reduce((n, rows) => n + rows.length, 0),
    },
    files: {
      'catalog.json': write('catalog.json', json(snapshot.catalogRows)),
      'texts.f16': write('texts.f16', texts),
      'text-rows.json': write('text-rows.json', json(snapshot.textRows)),
      'index.usearch': (() => {
        const bytes = readFileSync(indexPath);
        return { sha256: sha256(bytes), bytes: bytes.byteLength };
      })(),
    },
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}
