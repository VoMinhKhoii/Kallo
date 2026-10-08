import 'server-only';

import { Errors } from '@/lib/core/errors/catalog';

/**
 * Hard cap at the R2 free tier. Cloudflare has no spend limit (budget alerts
 * only notify), so the app stops itself: past 95% of a meter, uploads (storage,
 * Class A) or photo links and avatars (Class B) stop until usage falls back.
 * Deletes are never capped — they are free, and erasure must not be blocked.
 *
 * Usage is read from Cloudflare's GraphQL Analytics API for the whole ACCOUNT
 * (dev and prod buckets share one free tier), over the trailing 31 days:
 * every billing period-to-date fits inside that window whatever day the cycle
 * starts, so the sum can only over-count. Storage is capped on current bytes,
 * which bounds the GB-month average from above.
 */

const FREE_TIER = {
  storageBytes: 10e9,
  classA: 1_000_000,
  classB: 10_000_000,
};
const CAP_RATIO = 0.95;

/**
 * R2 pricing, operation → class. Only the free operations are named; every
 * other operation counts — Get and Head operations as Class B, the rest as
 * Class A. An operation the pricing page doesn't list (the dashboard's
 * GetBucketSippyConfiguration, a future ListObjectsV2 label) is therefore
 * counted, never silently dropped: the cap can only trip early, not late.
 */
const FREE = new Set([
  'DeleteObject',
  'DeleteObjects',
  'DeleteBucket',
  'AbortMultipartUpload',
]);

function operationClass(actionType: string): 'A' | 'B' | null {
  if (FREE.has(actionType)) return null;
  return /^(Get|Head)/.test(actionType) || actionType === 'UsageSummary'
    ? 'B'
    : 'A';
}

const WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
/** Storage is sampled; the last day's max per bucket is its current size. */
const STORAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const FRESH_MS = 5 * 60 * 1000;
/** After a failed read, keep the last good answer this long, then fail closed. */
const STALE_LIMIT_MS = 60 * 60 * 1000;
/** A failed read is retried at most this often, not on every request. */
const RETRY_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;
const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

export interface R2Usage {
  storageBytes: number;
  classA: number;
  classB: number;
}

interface Verdict {
  at: number;
  writes: boolean;
  reads: boolean;
}

const QUERY = `query R2Usage($accountTag: string!, $since: Time!, $storageSince: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      ops: r2OperationsAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $since, datetime_leq: $until }
      ) {
        sum { requests }
        dimensions { actionType }
      }
      storage: r2StorageAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $storageSince, datetime_leq: $until }
      ) {
        max { payloadSize metadataSize }
        dimensions { bucketName }
      }
    }
  }
}`;

interface UsageResponse {
  data?: {
    viewer?: {
      accounts?: {
        ops?: {
          sum: { requests: number };
          dimensions: { actionType: string };
        }[];
        storage?: {
          max: { payloadSize: number; metadataSize: number };
        }[];
      }[];
    };
  };
  errors?: { message: string }[] | null;
}

/** Month-to-date (trailing 31 days) R2 usage for the whole account. */
export async function fetchR2Usage(
  accountId: string,
  token: string,
  now = Date.now()
): Promise<R2Usage> {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: accountId,
        since: new Date(now - WINDOW_MS).toISOString(),
        storageSince: new Date(now - STORAGE_WINDOW_MS).toISOString(),
        until: new Date(now).toISOString(),
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare analytics answered ${response.status}`);
  }
  const body = (await response.json()) as UsageResponse;
  if (body.errors?.length) {
    throw new Error(`Cloudflare analytics: ${body.errors[0]?.message}`);
  }
  const account = body.data?.viewer?.accounts?.[0];
  if (!account) throw new Error('Cloudflare analytics returned no account');

  const usage: R2Usage = { storageBytes: 0, classA: 0, classB: 0 };
  for (const group of account.ops ?? []) {
    const kind = operationClass(group.dimensions.actionType);
    if (kind === 'A') usage.classA += group.sum.requests;
    else if (kind === 'B') usage.classB += group.sum.requests;
  }
  for (const bucket of account.storage ?? []) {
    usage.storageBytes += bucket.max.payloadSize + bucket.max.metadataSize;
  }
  return usage;
}

export function judgeUsage(usage: R2Usage): {
  writes: boolean;
  reads: boolean;
} {
  return {
    writes:
      usage.storageBytes < FREE_TIER.storageBytes * CAP_RATIO &&
      usage.classA < FREE_TIER.classA * CAP_RATIO,
    reads: usage.classB < FREE_TIER.classB * CAP_RATIO,
  };
}

let verdict: Verdict | null = null;
let lastGood: Verdict | null = null;
let inflight: Promise<Verdict> | null = null;
let warnedUnconfigured = false;

function credentials(): { accountId: string; token: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (accountId && token) return { accountId, token };
  if (!warnedUnconfigured) {
    warnedUnconfigured = true;
    console.warn(
      '[storage] CLOUDFLARE_ANALYTICS_TOKEN or R2_ACCOUNT_ID unset — the R2 free-tier cap is OFF.'
    );
  }
  return null;
}

async function refresh(accountId: string, token: string): Promise<Verdict> {
  const now = Date.now();
  try {
    const judged = judgeUsage(await fetchR2Usage(accountId, token, now));
    lastGood = { at: now, ...judged };
    if (!judged.writes || !judged.reads) {
      console.error('[storage] R2 free-tier cap reached:', judged);
    }
    return lastGood;
  } catch (error) {
    console.error('[storage] Reading R2 usage failed:', error);
    if (lastGood && now - lastGood.at < STALE_LIMIT_MS) {
      // Keep the last good answer, but retry soon rather than in FRESH_MS.
      return { ...lastGood, at: now - FRESH_MS + RETRY_MS };
    }
    // Unknown usage: uploads stop (a hard cap must not guess), reads go on —
    // an analytics outage should not blank every avatar.
    return { at: now - FRESH_MS + RETRY_MS, writes: false, reads: true };
  }
}

/** The current verdict, refreshed when older than FRESH_MS. Null = cap off. */
async function currentVerdict(): Promise<Verdict | null> {
  const creds = credentials();
  if (!creds) return null;
  if (verdict && Date.now() - verdict.at < FRESH_MS) return verdict;
  inflight ??= refresh(creds.accountId, creds.token).finally(() => {
    inflight = null;
  });
  verdict = await inflight;
  return verdict;
}

export async function assertWritesWithinCap(): Promise<void> {
  const current = await currentVerdict();
  if (current && !current.writes) throw Errors.storagePaused();
}

export async function assertReadsWithinCap(): Promise<void> {
  const current = await currentVerdict();
  if (current && !current.reads) throw Errors.storagePaused();
}

/**
 * Synchronous read for URL builders: the last verdict, never blocking. A
 * stale or missing one starts a refresh in the background.
 */
export function readsWithinCap(): boolean {
  if (!verdict || Date.now() - verdict.at >= FRESH_MS) {
    void currentVerdict().catch(() => {});
  }
  return verdict?.reads ?? true;
}

/** Test seam: forget every cached verdict. */
export function resetUsageCapForTests(): void {
  verdict = null;
  lastGood = null;
  inflight = null;
  warnedUnconfigured = false;
}
