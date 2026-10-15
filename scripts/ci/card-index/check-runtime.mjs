/**
 * CI check, run inside the built image (mounted read-only at /check):
 *
 *   docker run --rm -v "$PWD/scripts/ci/card-index:/check:ro" <image> \
 *     node /check/check-runtime.mjs
 *
 * The card search worker runs outside the Next bundle and the Dockerfile copies
 * it and usearch in by hand. This writes a small artifact to /tmp, spawns the
 * image's own worker over file://, and searches it, so a missing file, module
 * or native binary fails CI instead of a deploy. APP_DIR (default /app) points
 * it at another tree, e.g. the repo root when run locally.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

const app = process.env.APP_DIR ?? '/app';
const dir = join(app, 'lib/ai/matching/cards/search-index');
const core = await import(pathToFileURL(join(dir, 'search-core.mjs')).href);
const { Index } = createRequire(join(app, 'package.json'))('usearch');

const COUNT = 64;
const texts = new Uint16Array(COUNT * core.DIMS);
for (let k = 0; k < texts.length; k++) {
  texts[k] = core.floatToHalf(Math.sin(k * 0.731) + Math.cos(k * 0.0173));
}
const { prefixes } = core.prepareTexts(texts);
const index = new Index(core.INDEX_PARAMS);
const keys = new BigUint64Array(COUNT);
for (let i = 0; i < COUNT; i++) keys[i] = BigInt(i);
index.add(keys, prefixes, 1);

const out = mkdtempSync(join(tmpdir(), 'card-index-check-'));
const files = {};
const put = (name, bytes) => {
  writeFileSync(join(out, name), bytes);
  files[name] = {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  };
};
index.save(join(out, 'index.usearch'));
put('index.usearch', readFileSync(join(out, 'index.usearch')));
put('texts.f16', Buffer.from(texts.buffer));
put(
  'text-rows.json',
  Buffer.from(
    JSON.stringify(Array.from({ length: COUNT }, (_, i) => [`row_${i}`]))
  )
);
put('catalog.json', Buffer.from('[]'));
const manifest = {
  format: 1,
  buildId: 'ci-check',
  counts: { catalogRows: 1, texts: COUNT, links: COUNT },
  files,
};

const worker = new Worker(join(dir, 'worker.mjs'), {
  workerData: { uri: pathToFileURL(out).href, manifest },
});
const fail = (why) => {
  console.error(`card search worker check failed: ${why}`);
  process.exit(1);
};
const timer = setTimeout(() => fail('no answer in 30 s'), 30_000);
worker.on('error', (err) => fail(String(err)));
worker.on('message', (msg) => {
  if (msg.type === 'failed') fail(msg.error);
  if (msg.type === 'ready') {
    const query = Array.from(
      texts.subarray(5 * core.DIMS, 6 * core.DIMS),
      core.halfToFloat
    );
    worker.postMessage({ id: 1, queries: [query] });
    return;
  }
  if (msg.id === 1) {
    clearTimeout(timer);
    const [best] = msg.hits?.[0] ?? [];
    if (msg.error || !best || best[0] !== 'row_5' || !(best[1] > 0.999)) {
      fail(msg.error ?? `unexpected top hit ${JSON.stringify(best)}`);
    }
    console.log(
      `card search worker ok (${process.platform}-${process.arch}, node ${process.versions.node}): ${best[0]} ${best[1].toFixed(4)}`
    );
    void worker.terminate().then(() => process.exit(0));
  }
});
