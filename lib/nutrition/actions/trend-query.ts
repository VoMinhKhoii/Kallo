import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { mealItems, meals } from '@/lib/db/schema';
import { localDateSqlExpression } from '../date-range';
import type { NutritionNutrientKey } from '../types';

interface TrendQueryArgs {
  userId: string;
  nutrient: NutritionNutrientKey;
  startDate: string;
  endDate: string;
  startAt: Date;
  endAt: Date;
  timezoneOffset: number | null;
}

export interface TrendMealItemRow {
  localDate: string;
  calories: number;
  value: number | null;
}

const NUTRIENT_COLUMN_MAP = {
  fiberG: mealItems.fiberG,
  sodiumMg: mealItems.sodiumMg,
  calciumMg: mealItems.calciumMg,
  ironMg: mealItems.ironMg,
  magnesiumMg: mealItems.magnesiumMg,
  phosphorusMg: mealItems.phosphorusMg,
  potassiumMg: mealItems.potassiumMg,
  zincMg: mealItems.zincMg,
  copperMcg: mealItems.copperMcg,
  manganeseMg: mealItems.manganeseMg,
  betaCaroteneMcg: mealItems.betaCaroteneMcg,
  vitaminAMcg: mealItems.vitaminAMcg,
  vitaminDMcg: mealItems.vitaminDMcg,
  vitaminEMg: mealItems.vitaminEMg,
  vitaminKMcg: mealItems.vitaminKMcg,
  vitaminCMg: mealItems.vitaminCMg,
  vitaminB1Mg: mealItems.vitaminB1Mg,
  vitaminB2Mg: mealItems.vitaminB2Mg,
  vitaminPpMg: mealItems.vitaminPpMg,
  vitaminB5Mg: mealItems.vitaminB5Mg,
  vitaminB6Mg: mealItems.vitaminB6Mg,
  vitaminB9Mcg: mealItems.vitaminB9Mcg,
  vitaminB12Mcg: mealItems.vitaminB12Mcg,
  vitaminHMcg: mealItems.vitaminHMcg,
} satisfies Record<NutritionNutrientKey, PgColumn>;

export async function fetchTrendRows({
  userId,
  nutrient,
  startDate,
  endDate,
  startAt,
  endAt,
  timezoneOffset,
}: TrendQueryArgs): Promise<TrendMealItemRow[]> {
  const localDate = sql<string>`${sql.raw(
    localDateSqlExpression('meals.logged_at', timezoneOffset)
  )}`;

  return db
    .select({
      localDate,
      calories: sql<number>`coalesce(${mealItems.caloriesKcal}, 0)`,
      value: NUTRIENT_COLUMN_MAP[nutrient],
    })
    .from(meals)
    .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, startAt),
        lte(meals.loggedAt, endAt),
        gte(localDate, startDate),
        lte(localDate, endDate)
      )
    );
}
