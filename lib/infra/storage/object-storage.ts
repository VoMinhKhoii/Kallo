import 'server-only';

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { removeLegacyKeys, removeLegacyPrefix } from './legacy-supabase';
import {
  assertR2Configured,
  r2BucketName,
  r2Client,
  type StorageBucket,
} from './r2-client';
import {
  assertReadsWithinCap,
  assertWritesWithinCap,
  readsWithinCap,
} from './usage-cap';

/**
 * Object storage (Cloudflare R2, S3 API). Every read and write runs on the
 * server with the app's R2 credentials: no client ever holds a storage token,
 * so the code that calls these functions is the whole access policy — it
 * builds every key from the authenticated user's id and checks bytes before
 * they land here.
 */
export type { StorageBucket };

export interface StoredObject {
  key: string;
  lastModified: Date | null;
}

/**
 * Fail fast on missing credentials — for callers that must not start a
 * database write whose storage half would then fail.
 */
export function assertObjectStorageConfigured(): void {
  assertR2Configured();
}

/**
 * Throws `STORAGE_PAUSED` once the R2 free-tier cap stops uploads
 * (`usage-cap.ts`). `putObject` checks it itself; callers that do Class A work
 * before the write (a quota listing) check it first.
 */
export function assertUploadsAllowed(): Promise<void> {
  return assertWritesWithinCap();
}

/** False once the cap stops reads: URL builders hand out no storage URL. */
export function storageReadsAllowed(): boolean {
  return readsWithinCap();
}

/** S3 DeleteObjects takes at most 1000 keys per request. */
const DELETE_BATCH = 1000;

/**
 * Write a new object. Never overwrites: `If-None-Match: *` makes R2 answer
 * 412 when the key exists (keys carry a random UUID, so that means a bug).
 * Refused with `STORAGE_PAUSED` past the free-tier cap.
 */
export async function putObject(
  bucket: StorageBucket,
  key: string,
  body: Uint8Array,
  options: { contentType: string; cacheControl?: string }
): Promise<void> {
  await assertWritesWithinCap();
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2BucketName(bucket),
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      IfNoneMatch: '*',
    })
  );
}

/** Every object under `prefix`, following continuation tokens past the
 *  1000-key page. */
export async function listObjects(
  bucket: StorageBucket,
  prefix: string
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let token: string | undefined;
  do {
    const page = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: r2BucketName(bucket),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const object of page.Contents ?? []) {
      if (object.Key) {
        objects.push({
          key: object.Key,
          lastModified: object.LastModified ?? null,
        });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

/**
 * Delete these keys, and their legacy Supabase copies (`legacy-supabase.ts`).
 * Throws if R2 reports any key it could not delete, or the legacy delete fails.
 */
export async function removeObjects(
  bucket: StorageBucket,
  keys: string[]
): Promise<void> {
  for (let start = 0; start < keys.length; start += DELETE_BATCH) {
    const batch = keys.slice(start, start + DELETE_BATCH);
    const result = await r2Client().send(
      new DeleteObjectsCommand({
        Bucket: r2BucketName(bucket),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
    const failed = result.Errors ?? [];
    if (failed.length > 0) {
      throw new Error(
        `Could not delete ${failed.length} object(s): ${failed[0]?.Code ?? 'unknown'}`
      );
    }
  }
  await removeLegacyKeys(bucket, keys);
}

/**
 * Delete every object under a `{segment}/` prefix, re-listing until empty so
 * an object written mid-purge is caught too, then the same prefix in the
 * legacy Supabase bucket.
 * Refuses an empty or unterminated prefix so a bad id can never widen the
 * purge to the whole bucket or to a sibling (`abc` would match `abcd/…`).
 */
export async function removePrefix(
  bucket: StorageBucket,
  prefix: string
): Promise<void> {
  if (prefix.length < 2 || !prefix.endsWith('/') || prefix.startsWith('/')) {
    throw new Error('removePrefix needs a non-empty `{segment}/` prefix.');
  }
  for (;;) {
    const objects = await listObjects(bucket, prefix);
    if (objects.length === 0) break;
    await removeObjects(
      bucket,
      objects.map((object) => object.key)
    );
  }
  // Legacy copies R2 never had (uploaded between the copy and the cutover).
  await removeLegacyPrefix(bucket, prefix);
}

/**
 * A presigned GET for one private object, valid for `ttlSeconds`. Refused
 * with `STORAGE_PAUSED` past the free-tier cap on reads.
 */
export async function signedReadUrl(
  bucket: StorageBucket,
  key: string,
  ttlSeconds: number
): Promise<string> {
  await assertReadsWithinCap();
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key }),
    { expiresIn: ttlSeconds }
  );
}
