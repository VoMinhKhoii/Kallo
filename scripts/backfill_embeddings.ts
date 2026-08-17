/**
 * Backfill embeddings for vietnamese_food_composition table.
 *
 * Uses gemini-embedding-001 (768 dimensions) to generate embeddings
 * from concatenated food names and categories.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/backfill_embeddings.ts
 *   bun --env-file=.env.local scripts/backfill_embeddings.ts \
 *     --ids=usda_6008_raw,usda_6170_raw
 *
 * Requires DATABASE_URL, plus one of two providers (same contract as
 * lib/ai/provider/client.ts and scripts/translate-usda-vietnamese/keys.ts):
 *   - AI_PROVIDER=vertex: GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION, auth via
 *     Application Default Credentials. This is what the prod deploy uses, so
 *     the backfill bills the same quota as the service it is deploying.
 *   - otherwise (AI Studio): GEMINI_API_KEY — the local `dbr:reset` path.
 */

import { GoogleGenAI } from '@google/genai';
import { and, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db';
import { vietnameseFoodComposition } from '@/lib/infra/db/schema';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const BATCH_SIZE = 50;
const MAX_RETRIES = 5;
/**
 * Pause between batches, per provider.
 *
 * 35s is NOT an inherent property of gemini-embedding-001 — it is the Google
 * AI Studio FREE-tier ceiling of 100 embed requests/min, where each text
 * counts as one request: BATCH_SIZE=50 texts twice a minute needs ~35s of
 * spacing. Vertex AI is billed and its embedding quota is per-project
 * requests-per-minute, orders of magnitude above 100, so paying 35s there
 * would ceiling the prod deploy's backfill step at ~25 batches (~1,250 rows)
 * before its timeout — and this script deliberately fails the build when rows
 * remain.
 *
 * Vertex still gets a small non-zero pause rather than 0: quotas are high but
 * finite, and the retry path below only tolerates MAX_RETRIES=5 before failing
 * the deploy, so it is a last resort rather than the pacing mechanism. 2s
 * between 50-text batches is ~1,500 texts/min — comfortably inside Vertex
 * quota, and only ~50s of total sleep across the ~25 batches that used to
 * consume the entire 15-minute step.
 */
const AI_STUDIO_FREE_TIER_BATCH_DELAY_MS = 35_000;
const VERTEX_BATCH_DELAY_MS = 2_000;

const idsArg = process.argv.find((arg) => arg.startsWith('--ids='));
const requestedIds = idsArg
  ? [
      ...new Set(
        idsArg
          .slice('--ids='.length)
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ]
  : [];

if (idsArg && requestedIds.length === 0) {
  console.error('--ids must contain at least one food composition id');
  process.exit(1);
}

const useVertex = process.env.AI_PROVIDER?.trim() === 'vertex';

if (!process.env.DATABASE_URL || (!useVertex && !process.env.GEMINI_API_KEY)) {
  console.error(
    'Missing DATABASE_URL or GEMINI_API_KEY. Run with:',
    '\n  bun --env-file=.env.local scripts/backfill_embeddings.ts'
  );
  process.exit(1);
}

function createGenAI(): GoogleGenAI {
  if (!useVertex) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  if (!project || !location) {
    throw new Error(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
  }
  console.log(`Using Vertex AI (project=${project}, location=${location})`);
  return new GoogleGenAI({ vertexai: true, project, location });
}

// Built before the postgres client so a provider misconfiguration fails
// without opening a DB connection nothing will close.
const genai = createGenAI();
const client = postgres(encodeDbUrl(process.env.DATABASE_URL!));
const db = drizzle(client);
const BATCH_DELAY_MS = useVertex
  ? VERTEX_BATCH_DELAY_MS
  : AI_STUDIO_FREE_TIER_BATCH_DELAY_MS;

function buildEmbeddingText(row: {
  namePrimary: string;
  nameAlt: string[] | null;
  nameEn: string;
  typeVn: string;
  typeEn: string;
}): string {
  const alt = row.nameAlt?.length ? ` ${row.nameAlt.join(' ')}` : '';
  return `${row.namePrimary}${alt} ${row.nameEn} ${row.typeVn} ${row.typeEn}`;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts.map((text) => ({ parts: [{ text }] })),
        config: { outputDimensionality: 768 },
      });
      return result.embeddings!.map((e) => e.values!);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      // Parse retry delay from 429 response, fallback to exponential
      const retryMatch = err.message?.match(/retry in ([\d.]+)s/i);
      const delay = retryMatch
        ? Math.ceil(Number.parseFloat(retryMatch[1]) * 1000) + 1000
        : 1000 * 2 ** attempt;
      console.warn(
        `Retry ${attempt}/${MAX_RETRIES} in ${(delay / 1000).toFixed(0)}s`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

/**
 * Batch UPDATE using unnest — single query per batch instead of N queries.
 */
async function updateBatch(
  ids: string[],
  embeddings: number[][]
): Promise<void> {
  // Build VALUES list directly as raw SQL to avoid parameter binding
  // issues with vector arrays
  const rows = ids.map((id, i) => {
    const vec = `[${embeddings[i].join(',')}]`;
    // Escape single quotes in id (defensive)
    const safeId = id.replace(/'/g, "''");
    return `('${safeId}', '${vec}'::vector(768))`;
  });

  await db.execute(
    sql.raw(`
    UPDATE vietnamese_food_composition AS vfc
    SET embedding = data.vec
    FROM (VALUES ${rows.join(',')}) AS data(id, vec)
    WHERE vfc.id = data.id
  `)
  );
}

async function countMissingEmbeddings(ids?: string[]): Promise<number> {
  const scope = ids?.length
    ? and(
        inArray(vietnameseFoodComposition.id, ids),
        isNull(vietnameseFoodComposition.embedding)
      )
    : isNull(vietnameseFoodComposition.embedding);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(vietnameseFoodComposition)
    .where(scope);

  return Number(result?.count ?? 0);
}

async function main() {
  try {
    const rows = await db
      .select({
        id: vietnameseFoodComposition.id,
        namePrimary: vietnameseFoodComposition.namePrimary,
        nameAlt: vietnameseFoodComposition.nameAlt,
        nameEn: vietnameseFoodComposition.nameEn,
        typeVn: vietnameseFoodComposition.typeVn,
        typeEn: vietnameseFoodComposition.typeEn,
      })
      .from(vietnameseFoodComposition)
      .where(
        requestedIds.length > 0
          ? inArray(vietnameseFoodComposition.id, requestedIds)
          : isNull(vietnameseFoodComposition.embedding)
      );

    console.log(
      requestedIds.length > 0
        ? `Found ${rows.length}/${requestedIds.length} requested rows to re-embed`
        : `Found ${rows.length} rows without embeddings`
    );

    if (requestedIds.length > 0 && rows.length !== requestedIds.length) {
      const found = new Set(rows.map((row) => row.id));
      const missing = requestedIds.filter((id) => !found.has(id));
      throw new Error(`Requested food rows not found: ${missing.join(', ')}`);
    }

    if (rows.length === 0) {
      console.log('Nothing to do');
      return;
    }

    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map(buildEmbeddingText);

      const embeddings = await embedBatch(texts);
      await updateBatch(
        batch.map((r) => r.id),
        embeddings
      );

      processed += batch.length;
      console.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${processed}/${rows.length}`
      );

      // Rate-limit: wait between batches to stay under the provider's quota
      if (i + BATCH_SIZE < rows.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const remaining = await countMissingEmbeddings(
      requestedIds.length > 0 ? requestedIds : undefined
    );
    if (remaining > 0) {
      const scope = requestedIds.length > 0 ? 'requested' : 'food';
      throw new Error(
        `Embedding backfill incomplete: ${remaining} ${scope} row(s) still have NULL embeddings`
      );
    }

    console.log(
      requestedIds.length > 0
        ? `Verified ${requestedIds.length} requested row(s) have embeddings.`
        : 'Verified all food rows have embeddings.'
    );
    console.log(`Done. ${processed} embeddings generated.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
