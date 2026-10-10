#!/usr/bin/env bun
/**
 * Apply the food-card SQL (card-sql.ts) to DATABASE_URL — for databases whose
 * composition rows arrived after the seed migration ran (a `supabase db reset`
 * loads supabase/seed.sql after migrations). Idempotent. Follow it with
 * scripts/db/backfill_card_embeddings.ts.
 *
 *   bun --env-file=.env.local scripts/data/food-cards/sync-cards.ts
 */
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db/client';
import { buildCardSql } from './card-sql';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = postgres(encodeDbUrl(process.env.DATABASE_URL), { max: 1 });
try {
  const { sql: text, cards } = buildCardSql();
  await sql.begin((tx) => tx.unsafe(text));
  const [{ n, pending }] = await sql<{ n: number; pending: number }[]>`
    SELECT (SELECT count(*) FROM food_cards)::int AS n,
           (SELECT count(*) FROM food_card_vectors WHERE embedding IS NULL)::int AS pending`;
  console.log(
    `synced ${cards} cards from the file; ${n} in the database; ${pending} strings to embed`
  );
} finally {
  await sql.end();
}
