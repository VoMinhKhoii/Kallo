/**
 * The few Cloud Storage calls the builder makes, over the JSON API with an
 * OAuth token (no SDK). Every write carries an `ifGenerationMatch`
 * precondition: 0 creates only if absent (artifact files, new pointers); a
 * read generation replaces only that exact version (a forced pointer).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const API = 'https://storage.googleapis.com';

let cachedToken: string | null = null;

/** `GCS_ACCESS_TOKEN`, else the active gcloud account's token (CI and local). */
export function accessToken(): string {
  cachedToken ??=
    process.env.GCS_ACCESS_TOKEN?.trim() ||
    execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8',
    }).trim();
  return cachedToken;
}

const objectUrl = (bucket: string, name: string) =>
  `${API}/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`;

async function request(url: string, init: RequestInit = {}, attempt = 1) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken()}`, ...init.headers },
    signal: AbortSignal.timeout(120_000),
  }).catch((err: unknown) => err as Error);
  const retryable =
    res instanceof Error || res.status === 429 || res.status >= 500;
  if (retryable && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return request(url, init, attempt + 1);
  }
  if (res instanceof Error) throw res;
  return res;
}

export interface ObjectMeta {
  generation: string;
  md5Hash: string;
}

export async function getMeta(
  bucket: string,
  name: string
): Promise<ObjectMeta | null> {
  const res = await request(objectUrl(bucket, name));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GCS metadata ${name}: ${res.status}`);
  return (await res.json()) as ObjectMeta;
}

export async function download(
  bucket: string,
  name: string
): Promise<{ body: Buffer; generation: string } | null> {
  const res = await request(`${objectUrl(bucket, name)}?alt=media`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GCS download ${name}: ${res.status}`);
  // The generation decides what a forced pointer write replaces; never guess
  // it ('0' would mean "absent").
  const generation = res.headers.get('x-goog-generation');
  if (!generation || !/^[1-9]\d*$/.test(generation)) {
    throw new Error(`GCS download ${name}: no generation header`);
  }
  return { body: Buffer.from(await res.arrayBuffer()), generation };
}

async function post(
  bucket: string,
  name: string,
  body: Uint8Array,
  ifGenerationMatch: string,
  contentType: string
): Promise<number> {
  const url = `${API}/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}&ifGenerationMatch=${ifGenerationMatch}`;
  const res = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    // A copy backed by a plain ArrayBuffer, which fetch's body type requires.
    body: new Uint8Array(body),
  });
  return res.status;
}

/** `true` when written; `false` when the precondition failed (412). */
export async function upload(
  bucket: string,
  name: string,
  body: Uint8Array,
  ifGenerationMatch: string,
  contentType = 'application/octet-stream'
): Promise<boolean> {
  const status = await post(bucket, name, body, ifGenerationMatch, contentType);
  if (status === 412) return false;
  if (status < 200 || status >= 300) {
    throw new Error(`GCS upload ${name}: ${status}`);
  }
  return true;
}

/**
 * Create an immutable object. If it already exists (a retried upload whose
 * first attempt landed), accept it only when its bytes are identical.
 */
export async function createImmutable(
  bucket: string,
  name: string,
  body: Uint8Array,
  contentType = 'application/octet-stream'
): Promise<void> {
  const status = await post(bucket, name, body, '0', contentType);
  if (status >= 200 && status < 300) return;
  // 412: the object exists. 403: also possible for an existing object, since
  // the deployer may create but not overwrite. Either way, accept it only if
  // its bytes are ours (a retried upload whose first attempt landed).
  if (status !== 412 && status !== 403) {
    throw new Error(`GCS upload ${name}: ${status}`);
  }
  const meta = await getMeta(bucket, name);
  const ours = createHash('md5').update(body).digest('base64');
  if (meta?.md5Hash !== ours) {
    throw new Error(
      `GCS upload ${name}: ${status}, and the object is absent or holds other contents (check the deployer's bucket roles)`
    );
  }
}
