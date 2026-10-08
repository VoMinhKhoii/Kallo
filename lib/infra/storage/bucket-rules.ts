import type { StorageBucket } from './r2-client';

/**
 * What each bucket may hold — the size and type caps the Supabase buckets
 * enforced on the storage side (`file_size_limit` / `allowed_mime_types` in
 * 20260719145843 and 20260925123100). R2 has no bucket-level equivalent, so
 * every write is checked here, after the callers' own validation: a value
 * outside these is a bug upstream, and it never lands.
 *
 * - avatars: WebP only, 500 KB — the server re-encodes to a 512px WebP, and
 *   a public object can never be served as text/html or image/svg+xml.
 * - nutrition-labels: JPEG/PNG/WebP, 4 MiB (the scan's own image limit).
 * - feedback-screenshots: the route's 5 MB / JPEG/PNG/WebP limit (the
 *   Supabase bucket had none; RLS + the route stood in for it).
 */
const RULES: Record<StorageBucket, { maxBytes: number; types: string[] }> = {
  avatars: { maxBytes: 512_000, types: ['image/webp'] },
  'nutrition-labels': {
    maxBytes: 4 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'feedback-screenshots': {
    maxBytes: 5 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

export function assertFitsBucket(
  bucket: StorageBucket,
  body: Uint8Array,
  contentType: string
): void {
  const rule = RULES[bucket];
  if (!rule.types.includes(contentType)) {
    throw new Error(`${bucket} does not accept ${contentType}`);
  }
  if (body.byteLength === 0 || body.byteLength > rule.maxBytes) {
    throw new Error(
      `${bucket} takes 1–${rule.maxBytes} bytes, got ${body.byteLength}`
    );
  }
}
