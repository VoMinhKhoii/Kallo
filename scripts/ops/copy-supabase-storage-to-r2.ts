/**
 * One-way copy of every object in the three Supabase Storage buckets into
 * their R2 buckets, under the SAME keys — rows store keys, not URLs, so no
 * database change follows. Safe to re-run: an object already in R2 is skipped
 * (the write is `If-None-Match: *`), so a second pass after the deploy picks up
 * only what was uploaded in between. Supabase objects are left in place.
 *
 * Between the passes the OLD revision still deletes only from Supabase (a
 * removed avatar, a deleted account). Pass 2 therefore takes the deploy time:
 * an R2 key gone from Supabase and last written before it was copied in pass 1
 * and deleted since, so it is removed. Keys written after it are the new
 * revision's own uploads (R2-only by design) and are never touched.
 *
 *   pass 1, before the deploy:
 *     bun --conditions=react-server --env-file=<env> \
 *       scripts/ops/copy-supabase-storage-to-r2.ts [--dry-run]
 *   pass 2, after it (T = when the new revision took traffic, ISO 8601):
 *     … copy-supabase-storage-to-r2.ts --prune-deleted-before=T [--dry-run]
 *
 * Source: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Target: the R2_* variables (docs/STORAGE.md).
 */
import { createClient } from '@supabase/supabase-js';
import {
  listObjects,
  putObject,
  removeObjects,
  type StorageBucket,
} from '@/lib/infra/storage/object-storage';

const BUCKETS: StorageBucket[] = [
  'avatars',
  'feedback-screenshots',
  'nutrition-labels',
];
/** Mirrors `AVATAR_CACHE_CONTROL` in lib/actions/groups/avatar.ts. */
const CACHE_CONTROL: Partial<Record<StorageBucket, string>> = {
  avatars: 'public, max-age=300, s-maxage=86400',
};
const PAGE = 100;

const dryRun = process.argv.includes('--dry-run');
const pruneArg = process.argv
  .find((arg) => arg.startsWith('--prune-deleted-before='))
  ?.split('=')[1];
const pruneBefore = pruneArg ? new Date(pruneArg) : null;
if (pruneBefore && Number.isNaN(pruneBefore.getTime())) {
  throw new Error('--prune-deleted-before needs an ISO 8601 time.');
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Every object key in a Supabase bucket. Folders have a null `id`. */
async function listSupabaseKeys(
  bucket: string,
  folder = ''
): Promise<string[]> {
  const keys: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: PAGE, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.id === null)
        keys.push(...(await listSupabaseKeys(bucket, path)));
      else keys.push(path);
    }
    if (data.length < PAGE) return keys;
  }
}

function isAlreadyThere(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    ?.$metadata?.httpStatusCode;
  return status === 412;
}

async function copyBucket(bucket: StorageBucket) {
  const keys = await listSupabaseKeys(bucket);
  const tally = { found: keys.length, copied: 0, skipped: 0, failed: 0 };
  for (const objectKey of keys) {
    if (dryRun) continue;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(objectKey);
      if (error) throw error;
      await putObject(
        bucket,
        objectKey,
        new Uint8Array(await data.arrayBuffer()),
        {
          contentType: data.type || 'application/octet-stream',
          cacheControl: CACHE_CONTROL[bucket],
        }
      );
      tally.copied++;
    } catch (error) {
      if (isAlreadyThere(error)) {
        tally.skipped++;
        continue;
      }
      tally.failed++;
      console.error(`[${bucket}] ${objectKey}:`, error);
    }
  }
  const inR2 = await listObjects(bucket, '');
  // R2 must hold at least every Supabase key once the copy is done.
  const r2Keys = new Set(inR2.map((object) => object.key));
  const missing = keys.filter((k) => !r2Keys.has(k));

  // Pass-1 copies whose source was deleted before the cutover.
  const sourceKeys = new Set(keys);
  const deletedAtSource = pruneBefore
    ? inR2
        .filter(
          (object) =>
            !sourceKeys.has(object.key) &&
            object.lastModified !== null &&
            object.lastModified < pruneBefore
        )
        .map((object) => object.key)
    : [];
  if (!dryRun && deletedAtSource.length > 0) {
    await removeObjects(bucket, deletedAtSource);
  }
  return {
    bucket,
    ...tally,
    missingInR2: missing.length,
    pruned: deletedAtSource.length,
  };
}

const results = [];
for (const bucket of BUCKETS) results.push(await copyBucket(bucket));
console.table(results);
if (!dryRun && results.some((r) => r.failed > 0 || r.missingInR2 > 0)) {
  process.exitCode = 1;
}
