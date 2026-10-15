/**
 * Builds and publishes the card search artifact the containers load (the
 * catalog plus a vector index, so matching needs no database search). Run by
 * the prod deploy after the card-embedding backfill; the flow is `publish.ts`.
 *
 * Usage:
 *   bun scripts/data/food-cards/search-artifact/build-search-artifact.ts \
 *     --bucket <bucket> [--force] [--dry-run] [--out <dir>]
 *
 * --force rebuilds even when the key has a build and repoints the key at the
 * new one (needed after re-embedding strings under unchanged ids).
 * --dry-run builds and gates without uploading (no bucket needed).
 *
 * Env: DATABASE_URL (only ever read, inside READ ONLY transactions), optional
 * GCS_ACCESS_TOKEN. Prints CARD_INDEX_URI=gs://<bucket>/f<format>/<buildId>
 * (except on --dry-run) and appends it to $GITHUB_ENV when set.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { connect } from './connect';
import { createImmutable, download, upload } from './gcs';
import { runBuild } from './publish';

const { values: args } = parseArgs({
  options: {
    bucket: { type: 'string' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (!args.bucket && !args['dry-run']) throw new Error('--bucket is required');

/** The checked-out commit: a redeploy builds an older DEPLOY_SHA. */
function checkedOutSha(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

const sql = connect(databaseUrl);
try {
  const result = await runBuild(
    {
      sql,
      storage: { download, upload, createImmutable },
      gitSha: checkedOutSha(),
      now: () => new Date(),
      log: (message, detail) =>
        detail === undefined
          ? console.info(`[card-artifact] ${message}`)
          : console.info(`[card-artifact] ${message}`, detail),
    },
    {
      bucket: args.bucket ?? null,
      force: args.force,
      dryRun: args['dry-run'],
      outDir: args.out ?? mkdtempSync(join(tmpdir(), 'card-artifact-')),
    }
  );
  if (result.kind !== 'dry-run') {
    console.log(`CARD_INDEX_URI=${result.uri}`);
    if (process.env.GITHUB_ENV) {
      appendFileSync(process.env.GITHUB_ENV, `CARD_INDEX_URI=${result.uri}\n`);
    }
  }
} finally {
  await sql.end();
}
