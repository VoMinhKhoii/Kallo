import { sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';

export interface VectorHit {
  id: string;
  similarity: number;
}

/**
 * Nearest cards for each query vector via `match_food_cards` (one round trip).
 * Returns query index (0-based, input order) → rows by best similarity desc.
 */
export async function searchCardVectors(
  embeddings: number[][],
  db: AppDb
): Promise<Map<number, VectorHit[]>> {
  const out = new Map<number, VectorHit[]>();
  if (embeddings.length === 0) return out;
  const literal = `{${embeddings.map((v) => `"[${v.join(',')}]"`).join(',')}}`;
  const rows = (await db.execute(
    sql`SELECT query_index, food_composition_id, similarity FROM match_food_cards(${literal}::vector[])`
  )) as unknown as {
    query_index: number;
    food_composition_id: string;
    similarity: number;
  }[];
  for (const r of rows) {
    const q = Number(r.query_index) - 1;
    const list = out.get(q) ?? [];
    list.push({ id: r.food_composition_id, similarity: Number(r.similarity) });
    out.set(q, list);
  }
  for (const list of out.values())
    list.sort((a, b) => b.similarity - a.similarity);
  return out;
}
