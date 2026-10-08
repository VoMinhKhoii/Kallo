import 'server-only';

import { S3Client } from '@aws-sdk/client-s3';

/**
 * The three logical buckets. Each maps to its own R2 bucket because R2 sets
 * public access per bucket: `avatars` is public (served from its custom
 * domain), the other two are private and reachable only through this server
 * or a short-lived presigned URL.
 */
export type StorageBucket =
  | 'avatars'
  | 'feedback-screenshots'
  | 'nutrition-labels';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketPrefix: string;
}

/**
 * R2 credentials are server-only secrets, referenced by name. A missing one
 * throws a clear error — the same fail-loud contract as `createAdminClient` —
 * so a storage call never silently no-ops.
 */
function readConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketPrefix = process.env.R2_BUCKET_PREFIX;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketPrefix) {
    throw new Error(
      'Object storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_PREFIX to be set.'
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucketPrefix };
}

let cached: { signature: string; client: S3Client } | null = null;

/** One client per credential set, reused across requests. */
export function r2Client(): S3Client {
  const config = readConfig();
  const signature = `${config.accountId}:${config.accessKeyId}:${config.secretAccessKey}`;
  if (cached?.signature === signature) return cached.client;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    // Path-style keeps every presigned URL on the one account origin, which
    // is what the CSP allowlists (lib/infra/security/csp.ts).
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Only send/verify checksums where the S3 API requires one (DeleteObjects).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  cached = { signature, client };
  return client;
}

/** Throws the missing-credentials error now, before any side effect. */
export function assertR2Configured(): void {
  readConfig();
}

/** `{R2_BUCKET_PREFIX}-{bucket}`, e.g. `kallo-prod-avatars`. */
export function r2BucketName(bucket: StorageBucket): string {
  return `${readConfig().bucketPrefix}-${bucket}`;
}
