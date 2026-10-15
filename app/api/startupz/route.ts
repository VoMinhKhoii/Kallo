import { connection } from 'next/server';

import { cardIndexSettled } from '@/lib/ai/matching/cards/search-index/search-index';

/**
 * Cloud Run's startup probe (`cloud-run-prod.yml`): 503 while a new container
 * is still loading its card search build, 200 once it may take traffic (see
 * `cardIndexSettled`, which never holds a container back for long). No body.
 *
 * The probe cannot send the Cloudflare origin secret, so `proxy.ts` lets this
 * exact path through the origin lock; it reads in-memory state only (no
 * database, no work), so the raw run.app URL learns nothing beyond "starting".
 */
export async function GET() {
  // With Cache Components a GET handler that reads no request data can be
  // prerendered at build time; the answer must be this process's, now.
  await connection();
  return new Response(null, {
    status: cardIndexSettled() ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
