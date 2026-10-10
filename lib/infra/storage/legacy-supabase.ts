import 'server-only';

import { createAdminClient } from '@/lib/infra/supabase/admin';

import type { StorageBucket } from './r2-client';

/**
 * TRANSITIONAL. The objects copied to R2 stay in their Supabase Storage
 * buckets as the rollback path (docs/STORAGE.md), and the public avatar ones
 * stay reachable at their old URLs. So every delete is mirrored here — a
 * removed avatar or a deleted account must not survive in the legacy copy.
 * Delete this file, and its two calls in `object-storage.ts`, in the change
 * that drops the Supabase buckets.
 */

/** Same 100-per-page listing the pre-R2 account purge used. */
const PAGE = 100;

export async function removeLegacyKeys(
  bucket: StorageBucket,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  const { error } = await createAdminClient().storage.from(bucket).remove(keys);
  if (error) throw error;
}

/** Every legacy object under `{segment}/`, listing until empty. */
export async function removeLegacyPrefix(
  bucket: StorageBucket,
  prefix: string
): Promise<void> {
  const folder = prefix.slice(0, -1);
  const legacy = createAdminClient().storage.from(bucket);
  for (;;) {
    const { data, error } = await legacy.list(folder, {
      limit: PAGE,
      offset: 0,
    });
    if (error) throw error;
    // Folder entries (null id) cannot be removed; keys here are flat, and
    // stopping on them keeps a stray one from looping forever.
    const files = (data ?? []).filter((object) => object.id !== null);
    if (files.length === 0) return;
    const { error: removeError } = await legacy.remove(
      files.map((object) => `${prefix}${object.name}`)
    );
    if (removeError) throw removeError;
  }
}
