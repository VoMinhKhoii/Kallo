/**
 * What an artifact build depends on besides the data: the format, the search
 * parameters, the embedding model, the usearch version, and the code that
 * builds and serves it. Any change here produces a new artifact key, so a
 * builder fix or a parameter change is never answered with an old build.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  DIMS,
  INDEX_PARAMS,
  PER_QUERY,
  PREFIX_DIMS,
} from '@/lib/ai/matching/cards/search-index/search-core.mjs';
import { MATCHABLE_SOURCE_CODES } from '@/lib/ai/matching/match-constants';

/** Bumped when the artifact's file layout changes; also its GCS path prefix. */
export const ARTIFACT_FORMAT = 1;

/**
 * The model that produced the stored card vectors and the query vectors
 * (`lib/ai/provider/embeddings.ts`, `scripts/db/backfill_card_embeddings.ts`).
 * Re-embedding with another model must change this, which forces a rebuild.
 */
export const EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Every local module the builder runs, repo-relative. A unit test asserts this
 * equals the builder's actual local import graph, so the code hash below can
 * never miss a file.
 */
export const SPEC_FILES = [
  'lib/ai/matching/cards/catalog-sql.ts',
  'lib/ai/matching/cards/search-index/search-core.mjs',
  'lib/ai/matching/match-constants.ts',
  'scripts/data/food-cards/search-artifact/artifact-files.ts',
  'scripts/data/food-cards/search-artifact/build-search-artifact.ts',
  'scripts/data/food-cards/search-artifact/connect.ts',
  'scripts/data/food-cards/search-artifact/fingerprint.ts',
  'scripts/data/food-cards/search-artifact/gcs.ts',
  'scripts/data/food-cards/search-artifact/parity.ts',
  'scripts/data/food-cards/search-artifact/snapshot.ts',
  'scripts/data/food-cards/search-artifact/spec.ts',
] as const;

export function usearchVersion(): string {
  const pkg = JSON.parse(
    readFileSync('node_modules/usearch/package.json', 'utf8')
  ) as { version: string };
  return pkg.version;
}

export function codeSha256(): string {
  const hash = createHash('sha256');
  for (const file of [...SPEC_FILES].sort()) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(file));
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function buildSpec() {
  return {
    format: ARTIFACT_FORMAT,
    model: EMBEDDING_MODEL,
    dims: DIMS,
    prefixDims: PREFIX_DIMS,
    perQuery: PER_QUERY,
    index: INDEX_PARAMS,
    usearch: usearchVersion(),
    matchableSourceCodes: [...MATCHABLE_SOURCE_CODES].sort(),
    code: codeSha256(),
  };
}

export type ArtifactSpec = ReturnType<typeof buildSpec>;

/** The artifact's identity: one key per (data fingerprint, spec). */
export function artifactKey(fingerprint: object, spec: ArtifactSpec): string {
  return createHash('sha256')
    .update(JSON.stringify({ fingerprint, spec }))
    .digest('hex');
}
