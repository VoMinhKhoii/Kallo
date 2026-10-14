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
  return {
    body: Buffer.from(await res.arrayBuffer()),
    generation: res.headers.get('x-goog-generation') ?? '0',
  };
}

/** `true` when written; `false` when the precondition failed (412). */
export async function upload(
  bucket: string,
  name: string,
  body: Uint8Array,
  ifGenerationMatch: string,
  contentType = 'application/octet-stream'
): Promise<boolean> {
  const url = `${API}/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}&ifGenerationMatch=${ifGenerationMatch}`;
  const res = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    // A copy backed by a plain ArrayBuffer, which fetch's body type requires.
    body: new Uint8Array(body),
  });
  if (res.status === 412) return false;
  if (!res.ok) throw new Error(`GCS upload ${name}: ${res.status}`);
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
  contentType?: string
): Promise<void> {
  if (await upload(bucket, name, body, '0', contentType)) return;
  const meta = await getMeta(bucket, name);
  const ours = createHash('md5').update(body).digest('base64');
  if (meta?.md5Hash !== ours) {
    throw new Error(`GCS object ${name} already exists with other contents`);
  }
}
