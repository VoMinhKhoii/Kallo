/**
 * One-off, OWNER-RUN: retire the three Supabase Storage buckets that #416 left
 * behind as the rollback path when uploads moved to Cloudflare R2. Every
 * object was copied to R2 under the same key, and the app no longer reads or
 * writes Supabase Storage (docs/STORAGE.md).
 *
 * Run it only after the migration 20261015020000_drop_supabase_storage_policies
 * is applied. Supabase forbids SQL deletes on the storage tables, so the
 * buckets go through the Storage API: `emptyBucket`, then `deleteBucket`.
 *
 *   bun --env-file=<env> scripts/ops/delete-supabase-storage-buckets.ts
 *     (dry run, the default: prints each bucket's object count)
 *   … delete-supabase-storage-buckets.ts --confirm
 *     (empties and deletes each bucket, then prints a summary)
 *
 * Re-runnable: a bucket that is already gone is reported as such and skipped.
 * Exits 1 if any bucket could not be counted, emptied or deleted.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';

const BUCKETS = ['avatars', 'feedback-screenshots', 'nutrition-labels'];
const PAGE = 100;
/** `emptyBucket` can finish asynchronously; how often to retry the delete. */
const DELETE_ATTEMPTS = 5;
const DELETE_RETRY_MS = 3000;

const confirm = process.argv.includes('--confirm');
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

type Outcome =
  | { bucket: string; status: 'missing' }
  | { bucket: string; status: 'counted' | 'deleted'; objects: number }
  | { bucket: string; status: 'failed'; objects?: number; error: string };

/** Objects in a bucket, recursing into folders (entries with a null `id`). */
async function countObjects(bucket: string, folder = ''): Promise<number> {
  let count = 0;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: PAGE, offset });
    if (error) throw error;
    for (const entry of data) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      count += entry.id === null ? await countObjects(bucket, path) : 1;
    }
    if (data.length < PAGE) return count;
  }
}

async function bucketExists(bucket: string): Promise<boolean> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  return data.some((entry) => entry.id === bucket);
}

async function deleteBucket(bucket: string): Promise<void> {
  const emptied = await supabase.storage.emptyBucket(bucket);
  if (emptied.error) throw emptied.error;
  for (let attempt = 1; ; attempt++) {
    const deleted = await supabase.storage.deleteBucket(bucket);
    if (!deleted.error) return;
    if (attempt >= DELETE_ATTEMPTS) throw deleted.error;
    await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_MS));
  }
}

async function retire(bucket: string): Promise<Outcome> {
  let objects: number | undefined;
  try {
    if (!(await bucketExists(bucket))) return { bucket, status: 'missing' };
    objects = await countObjects(bucket);
    if (!confirm) return { bucket, status: 'counted', objects };
    await deleteBucket(bucket);
    return { bucket, status: 'deleted', objects };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { bucket, status: 'failed', objects, error: message };
  }
}

const outcomes: Outcome[] = [];
for (const bucket of BUCKETS) outcomes.push(await retire(bucket));

console.log(
  JSON.stringify({ mode: confirm ? 'confirm' : 'dry-run', outcomes }, null, 2)
);
if (!confirm) {
  console.log('Dry run: nothing was deleted. Re-run with --confirm.');
}
if (outcomes.some((outcome) => outcome.status === 'failed')) {
  process.exitCode = 1;
}
