'use server';

import { and, desc, notIlike, notInArray, sql } from 'drizzle-orm';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { vietnameseFoodComposition } from '@/lib/infra/db/schema';
import { NUTRIENT_META } from '../catalog/nutrients';
import { foodSourceCandidatesInputSchema } from '../schemas';

// Ranking by raw per-100g density surfaces things that are dense but you'd never
// portion to fill a gap: dried spices (1g of dried thyme tops vitamin K),
// fortified breakfast cereals, oils, sweets, shake/drink mixes, and
// yeast/leavening agents. Exclude those whole categories (USDA SR + VN FCT
// naming variants) so suggestions read like foods you'd actually eat. Whole-food
// groups — meats, vegetables, fruits, legumes, fish, nuts, grains, roots — stay.
const EXCLUDED_TYPES_EN = [
  'Condiments, traditional sauces',
  'Spices and Herbs',
  'Breakfast Cereals',
  'Fats and Oils',
  'Oil, lard, butter',
  'Sweets',
  'Sugar, confectionery',
  'Beverages',
  'Beverage and liquor',
  'Baked Products',
  'Soups, Sauces, and Gravies',
];

// The "Other" catch-all holds legit foods (e.g. goose liver) alongside fortified
// snack/supplement entries from USDA. Drop those by name marker rather than
// excluding the whole group: "Formulated bar, SNICKERS…", "…vitamin and mineral
// fortified", "Yeast extract spread".
const EXCLUDED_NAME_PATTERNS = [
  '%formulated%',
  '%fortified%',
  '%yeast extract%',
];

// A pool larger than what's shown at once, so the client can cycle through
// alternatives ("don't have these?") without another round-trip.
const POOL_SIZE = 18;

/// Top Vietnamese foods for a nutrient, ranked by per-100g density — derived
/// from the food-composition table so it works for ANY tracked nutrient (no
/// curated list). Returns a pool the client pages through.
export async function getFoodSourceCandidates(input: unknown) {
  const { nutrient } = foodSourceCandidatesInputSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  // Food sources answer a micronutrient question, so they follow that gate.
  await assertFeatureAccess(
    { userId: user.id, profileCreatedAt: profile.createdAt },
    'micronutrients'
  );

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
        notInArray(vietnameseFoodComposition.typeEn, EXCLUDED_TYPES_EN),
        ...EXCLUDED_NAME_PATTERNS.map((pattern) =>
          notIlike(vietnameseFoodComposition.nameEn, pattern)
        )
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
