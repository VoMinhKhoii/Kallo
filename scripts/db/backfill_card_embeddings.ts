/**
 * Backfill embeddings for food_card_vectors (the card retrieval index).
 *
 * The seed migration (supabase/migrations/*_seed_food_cards.sql) inserts one
 * row per string that names a card, with `embedding` NULL. This script embeds
 * every NULL row with gemini-embedding-001 (768 dimensions, default task type —
 * the same call lib/ai/provider/embeddings.ts makes for queries, so stored and
 * query vectors share a space) and verifies none remain.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/db/backfill_card_embeddings.ts
 *
 * Provider contract as scripts/db/backfill_embeddings.ts: AI_PROVIDER=vertex
 * (GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION, ADC; optional
 * GOOGLE_CLOUD_EMBEDDING_LOCATION, e.g. asia-southeast1) or GEMINI_API_KEY.
 * ~72k strings take ~11 min on Vertex at the pacing below (measured
 * 2026-10-08: 99.8k strings in 674 s, no 429s).
 */

import { GoogleGenAI } from '@google/genai';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db/client';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const BATCH_SIZE = 100;
const PARALLEL = 2;
const MAX_RETRIES = 6;
const PAGE = 2_000;

const useVertex = process.env.AI_PROVIDER?.trim() === 'vertex';
if (!process.env.DATABASE_URL || (!useVertex && !process.env.GEMINI_API_KEY)) {
  console.error(
    'Missing DATABASE_URL, and AI_PROVIDER=vertex or GEMINI_API_KEY'
  );
  process.exit(1);
}

function createGenAI(): GoogleGenAI {
  if (!useVertex)
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location =
    process.env.GOOGLE_CLOUD_EMBEDDING_LOCATION?.trim() ||
    process.env.GOOGLE_CLOUD_LOCATION?.trim();
  if (!project || !location) {
    throw new Error(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
  }
  console.log(`Using Vertex AI (project=${project}, location=${location})`);
  return new GoogleGenAI({ vertexai: true, project, location });
}

const genai = createGenAI();
const sql = postgres(encodeDbUrl(process.env.DATABASE_URL!), {
  max: PARALLEL + 1,
});

async function embed(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: { outputDimensionality: 768 },
      });
      const vecs = (r.embeddings ?? []).map((e) => e.values ?? []);
      if (vecs.length !== texts.length || vecs.some((v) => v.length !== 768)) {
        throw new Error(
          `got ${vecs.length} embeddings for ${texts.length} texts`
        );
      }
      return vecs;
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      const delay =
        (/429|RESOURCE_EXHAUSTED/.test(String(err)) ? 5_000 : 1_000) * attempt;
      console.warn(
        `Retry ${attempt}/${MAX_RETRIES} in ${delay / 1000}s: ${String(err).slice(0, 120)}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function store(rows: { id: number }[], vecs: number[][]) {
  const values = rows.map(
    (r, i) => `(${r.id}, '[${vecs[i].join(',')}]'::vector(768))`
  );
  await sql.unsafe(`
    UPDATE food_card_vectors AS v SET embedding = d.vec
    FROM (VALUES ${values.join(',')}) AS d(id, vec)
    WHERE v.id = d.id`);
}

async function main() {
  try {
    await sql`SET search_path TO public, extensions`;
    let done = 0;
    const t0 = Date.now();
    for (;;) {
      // Re-select each page: rows embedded by the previous page drop out.
      const rows = await sql<{ id: number; text: string }[]>`
        SELECT id, text FROM food_card_vectors
        WHERE embedding IS NULL ORDER BY id LIMIT ${PAGE}`;
      if (rows.length === 0) break;
      for (let i = 0; i < rows.length; i += BATCH_SIZE * PARALLEL) {
        await Promise.all(
          Array.from({ length: PARALLEL }, async (_, j) => {
            const batch = rows.slice(
              i + j * BATCH_SIZE,
              i + (j + 1) * BATCH_SIZE
            );
            if (batch.length)
              await store(batch, await embed(batch.map((r) => r.text)));
          })
        );
      }
      done += rows.length;
      console.log(
        `${done} embedded (${Math.round((Date.now() - t0) / 1000)}s)`
      );
    }
    const [{ remaining }] = await sql<{ remaining: number }[]>`
      SELECT count(*)::int AS remaining FROM food_card_vectors WHERE embedding IS NULL`;
    if (remaining > 0)
      throw new Error(`${remaining} card vector(s) still NULL`);
    console.log(`Done. ${done} card vectors embedded; none remain NULL.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Card backfill failed:', err);
  process.exit(1);
});
