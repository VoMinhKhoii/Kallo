'use server';

import { and, desc, ne, sql } from 'drizzle-orm';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { vietnameseFoodComposition } from '@/lib/db/schema';
import { NUTRIENT_META } from '../catalog/nutrients';
import { foodSourceCandidatesInputSchema } from '../schemas';

// Condiments are dense per-100g but you don't eat 100g of fish sauce — exclude
// them so suggestions read like foods you'd actually portion.
const CONDIMENT_TYPE_EN = 'Condiments, traditional sauces';

// A pool larger than what's shown at once, so the client can cycle through
// alternatives ("don't have these?") without another round-trip.
const POOL_SIZE = 18;

/// Top Vietnamese foods for a nutrient, ranked by per-100g density — derived
/// from the food-composition table so it works for ANY tracked nutrient (no
/// curated list). Returns a pool the client pages through.
export async function getFoodSourceCandidates(input: unknown) {
  const { nutrient } = foodSourceCandidatesInputSchema.parse(input);
  await requireAuthAndProfile();

  const column = vietnameseFoodComposition[nutrient];
  const unit = NUTRIENT_META[nutrient].unit;

  const rows = await db
    .select({
      id: vietnameseFoodComposition.id,
      name: vietnameseFoodComposition.namePrimary,
      nameEn: vietnameseFoodComposition.nameEn,
      amount: column,
    })
    .from(vietnameseFoodComposition)
    .where(
      and(
        sql`${column} > 0`,
        ne(vietnameseFoodComposition.typeEn, CONDIMENT_TYPE_EN)
      )
    )
    .orderBy(desc(column))
    // Overfetch, then dedupe raw/cooked variants of the same food below.
    .limit(POOL_SIZE * 3);

  const seen = new Set<string>();
  const foods: Array<{
    id: string;
    name: string;
    nameEn: string;
    amount: number;
    unit: string;
  }> = [];
  for (const row of rows) {
    const key = row.nameEn.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    foods.push({
      id: row.id,
      name: row.name,
      nameEn: row.nameEn,
      amount: Number(row.amount ?? 0),
      unit,
    });
    if (foods.length >= POOL_SIZE) break;
  }

  return { nutrient, foods };
}
