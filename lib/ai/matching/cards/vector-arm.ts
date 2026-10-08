import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';

export interface VectorHit {
  id: string;
  similarity: number;
}

type CardMatchRow = {
  query_index: number;
  food_composition_id: string;
  similarity: number;
};

/**
 * Nearest cards for each query vector via `match_food_cards` (one round trip).
 * Returns one list per input vector, in input order, best similarity first.
 */
export async function searchCardVectors(
  embeddings: number[][],
  db: AppDb
): Promise<VectorHit[][]> {
  const out: VectorHit[][] = embeddings.map(() => []);
  if (embeddings.length === 0) return out;
  const literal = `{${embeddings.map((v) => `"[${v.join(',')}]"`).join(',')}}`;
  const rows = await db.execute<CardMatchRow>(
    sql`SELECT query_index, food_composition_id, similarity FROM match_food_cards(${literal}::vector[])`
  );
  for (const r of rows) {
    out[Number(r.query_index) - 1]?.push({
      id: r.food_composition_id,
      similarity: Number(r.similarity),
    });
  }
  for (const list of out) list.sort((a, b) => b.similarity - a.similarity);
  return out;
}
