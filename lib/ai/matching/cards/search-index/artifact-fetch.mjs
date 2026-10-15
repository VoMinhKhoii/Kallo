/**
 * Reads the card search artifact's files from where the deploy published
 * them: `gs://<bucket>/<prefix>` (Cloud Storage, authorised with the
 * instance's metadata-server token) or `file:///<dir>` (tests, local runs, the
 * load test). Shared by the main thread (manifest, catalog) and the search
 * worker (vectors, index), so plain ESM with no local imports beyond Node's.
 * Every read has a timeout; a file whose size or sha256 differs from the
 * manifest is rejected.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** @type {{ value: string, expiresAt: number } | null} */
let cachedToken = null;

/** The runtime service account's token, refreshed a minute before expiry. */
async function accessToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(METADATA_TOKEN_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok) throw new Error(`metadata token: HTTP ${res.status}`);
  const body = /** @type {{ access_token: string, expires_in: number }} */ (
    await res.json()
  );
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return cachedToken.value;
}

/**
 * @param {string} uri
 * @returns {{ kind: 'gs', bucket: string, prefix: string } | { kind: 'file', dir: string }}
 */
export function parseArtifactUri(uri) {
  const gs = /^gs:\/\/([a-z0-9][a-z0-9._-]*)\/(.+?)\/?$/.exec(uri);
  if (gs) return { kind: 'gs', bucket: gs[1], prefix: gs[2] };
  if (uri.startsWith('file://'))
    return { kind: 'file', dir: fileURLToPath(uri) };
  throw new Error(`card index: unsupported artifact URI ${uri}`);
}

/**
 * One file of the artifact, as bytes.
 * @param {string} uri
 * @param {string} name
 * @param {number} timeoutMs
 * @returns {Promise<Buffer>}
 */
export async function readArtifactFile(uri, name, timeoutMs) {
  const where = parseArtifactUri(uri);
  if (where.kind === 'file') {
    return readFile(join(where.dir, name), {
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
  const object = encodeURIComponent(`${where.prefix}/${name}`);
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${where.bucket}/o/${object}?alt=media`,
    {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
  if (!res.ok) throw new Error(`card index: ${name}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * A file checked against its manifest entry.
 * @param {string} uri
 * @param {string} name
 * @param {{ sha256: string, bytes: number }} expected
 * @param {number} timeoutMs
 */
export async function readVerifiedFile(uri, name, expected, timeoutMs) {
  const bytes = await readArtifactFile(uri, name, timeoutMs);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== expected.bytes || sha256 !== expected.sha256) {
    throw new Error(
      `card index: ${name} does not match the manifest (${bytes.byteLength} bytes, sha256 ${sha256.slice(0, 12)})`
    );
  }
  return bytes;
}
