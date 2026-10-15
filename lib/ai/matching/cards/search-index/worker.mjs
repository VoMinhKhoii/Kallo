/**
 * The card search worker thread. It loads one artifact build's vectors and
 * HNSW index, checks them, and answers vector searches off the main thread
 * (`worker-client.ts`), so the native load (up to ~4 s on a cold host) and
 * the searches never freeze the server's event loop. Plain ESM outside the
 * Next bundle: spawned by path, copied into the image by the Dockerfile.
 *
 *   workerData   { uri, manifest }   (the manifest is read and validated by
 *                                      the main thread)
 *   in           { id, queries: number[][] }
 *   out          { type: 'ready', ms } | { type: 'failed', error }
 *                { id, hits: [rowId, similarity][][] } | { id, error }
 */
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import usearch from 'usearch';
import { readVerifiedFile } from './artifact-fetch.mjs';
import {
  DIMS,
  halfToFloat,
  INDEX_PARAMS,
  indexTopK,
  searchTexts,
  textNorms,
} from './search-core.mjs';

/**
 * @param {{ uri: string, manifest: { buildId: string, counts: { texts: number }, files: Record<string, { sha256: string, bytes: number }> } }} data
 */
async function load({ uri, manifest }) {
  const [indexBytes, textBytes, rowBytes] = await Promise.all([
    readVerifiedFile(
      uri,
      'index.usearch',
      manifest.files['index.usearch'],
      30_000
    ),
    readVerifiedFile(uri, 'texts.f16', manifest.files['texts.f16'], 30_000),
    readVerifiedFile(
      uri,
      'text-rows.json',
      manifest.files['text-rows.json'],
      10_000
    ),
  ]);
  // A Uint16Array view needs an even offset; copy only if it is not.
  const textBuffer =
    textBytes.byteOffset % 2 === 0 ? textBytes : Buffer.from(textBytes);
  const texts = new Uint16Array(
    textBuffer.buffer,
    textBuffer.byteOffset,
    textBuffer.byteLength / 2
  );
  /** @type {string[][]} */
  const textRows = JSON.parse(rowBytes.toString('utf8'));
  const count = manifest.counts.texts;
  if (texts.length !== count * DIMS || textRows.length !== count) {
    throw new Error(
      `card index: expected ${count} strings, got ${texts.length / DIMS} vectors and ${textRows.length} row lists`
    );
  }

  // usearch loads from a path. /tmp is memory on Cloud Run: delete the copy
  // as soon as the index holds it.
  const path = join(
    tmpdir(),
    `card-index-${manifest.buildId}-${process.pid}.usearch`
  );
  writeFileSync(path, indexBytes);
  const index = new usearch.Index(INDEX_PARAMS);
  try {
    index.load(path);
  } finally {
    unlinkSync(path);
  }
  if (Number(index.size()) !== count) {
    throw new Error(
      `card index: index holds ${index.size()} strings, expected ${count}`
    );
  }

  const store = { texts, norms: textNorms(texts), textRows };
  const topK = indexTopK(index, count);
  selfTest(store, topK, count);
  return { store, topK };
}

/**
 * The first, middle and last strings must each find themselves: one of the
 * rows they name, at similarity ≥ 0.999. Proves the index, the vectors and
 * the row map belong together before the worker reports ready.
 */
function selfTest(store, topK, count) {
  for (const i of new Set([0, Math.floor(count / 2), count - 1])) {
    const query = Array.from(
      store.texts.subarray(i * DIMS, (i + 1) * DIMS),
      halfToFloat
    );
    const [hits] = searchTexts(store, [query], topK, 10);
    const own = new Set(store.textRows[i]);
    if (!hits.some((h) => own.has(h.id) && h.similarity >= 0.999)) {
      throw new Error(`card index: self-test failed for string ${i}`);
    }
  }
}

const port = /** @type {import('node:worker_threads').MessagePort} */ (
  parentPort
);
const started = performance.now();
load(workerData).then(
  ({ store, topK }) => {
    port.on(
      'message',
      (/** @type {{ id: number, queries: number[][] }} */ msg) => {
        try {
          const results = searchTexts(store, msg.queries, topK);
          port.postMessage({
            id: msg.id,
            hits: results.map((list) => list.map((h) => [h.id, h.similarity])),
          });
        } catch (err) {
          port.postMessage({
            id: msg.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    );
    port.postMessage({
      type: 'ready',
      ms: Math.round(performance.now() - started),
    });
  },
  (err) => {
    port.postMessage({
      type: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }
);
