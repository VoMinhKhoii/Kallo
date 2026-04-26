import { and, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  ingredientSources,
  mealItems,
  meals,
  vietnameseFoodComposition,
} from '@/lib/db/schema';
import { localDateSqlExpression } from '../../pattern/date-range';

interface OverviewQueryArgs {
  userId: string;
  startDate: string;
  endDate: string;
  startAt: Date;
  exclusiveEndAt: Date;
  timezoneOffset: number | null;
}

export interface OverviewMealItemRow {
  localDate: string;
  calories: number;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sourceCode: string | null;
  typeEn: string | null;
  typeVn: string | null;
  calciumMg: number | null;
  ironMg: number | null;
  vitaminCMg: number | null;
  phosphorusMg: number | null;
  vitaminB1Mg: number | null;
  vitaminB2Mg: number | null;
  vitaminPpMg: number | null;
  vitaminAMcg: number | null;
  betaCaroteneMcg: number | null;
  sodiumMg: number | null;
  magnesiumMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  copperMcg: number | null;
  manganeseMg: number | null;
  vitaminB12Mcg: number | null;
  vitaminB9Mcg: number | null;
  vitaminB5Mg: number | null;
  vitaminB6Mg: number | null;
  vitaminEMg: number | null;
  vitaminKMcg: number | null;
}

function getLocalDateSql(timezoneOffset: number | null) {
  return localDateSqlExpression(meals.loggedAt, timezoneOffset);
}

function getOverviewWhere({
  userId,
  startDate,
  endDate,
  startAt,
  exclusiveEndAt,
  timezoneOffset,
}: OverviewQueryArgs) {
  const localDate = getLocalDateSql(timezoneOffset);

  return {
    localDate,
    where: and(
      eq(meals.userId, userId),
      gte(meals.loggedAt, startAt),
      lt(meals.loggedAt, exclusiveEndAt),
      gte(localDate, startDate),
      lte(localDate, endDate)
    ),
  };
}

export async function countLoggedDaysLast30(
  args: OverviewQueryArgs
): Promise<number> {
  const localDate = getLocalDateSql(args.timezoneOffset);
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${localDate})::int` })
    .from(meals)
    .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
    .where(
      and(
        eq(meals.userId, args.userId),
        gt(mealItems.caloriesKcal, 0),
        gte(meals.loggedAt, args.startAt),
        lt(meals.loggedAt, args.exclusiveEndAt),
        gte(localDate, args.startDate),
        lte(localDate, args.endDate)
      )
    );

  return Number(row?.count ?? 0);
}

export async function fetchOverviewRows(
  args: OverviewQueryArgs
): Promise<OverviewMealItemRow[]> {
  const { localDate, where } = getOverviewWhere(args);

  return db
    .select({
      localDate,
      // mealItems.caloriesKcal is `mode: 'number'` on the column, but Drizzle
      // does NOT propagate that mode through raw `sql\`\`` wrappers — the
      // result type is a string at runtime. Cast to float8 in SQL so the
      // downstream `+` arithmetic in groupDailyValues / sumRows is numeric,
      // not string concatenation.
      calories: sql<number>`(coalesce(${mealItems.caloriesKcal}, 0))::float8`,
      proteinG: mealItems.proteinG,
      carbohydrateG: mealItems.carbohydrateG,
      fatG: mealItems.fatG,
      fiberG: mealItems.fiberG,
      sourceCode: ingredientSources.code,
      typeEn: vietnameseFoodComposition.typeEn,
      typeVn: vietnameseFoodComposition.typeVn,
      calciumMg: mealItems.calciumMg,
      ironMg: mealItems.ironMg,
      vitaminCMg: mealItems.vitaminCMg,
      phosphorusMg: mealItems.phosphorusMg,
      vitaminB1Mg: mealItems.vitaminB1Mg,
      vitaminB2Mg: mealItems.vitaminB2Mg,
      vitaminPpMg: mealItems.vitaminPpMg,
      vitaminAMcg: mealItems.vitaminAMcg,
      betaCaroteneMcg: mealItems.betaCaroteneMcg,
      sodiumMg: mealItems.sodiumMg,
      magnesiumMg: mealItems.magnesiumMg,
      potassiumMg: mealItems.potassiumMg,
      zincMg: mealItems.zincMg,
      copperMcg: mealItems.copperMcg,
      manganeseMg: mealItems.manganeseMg,
      vitaminB12Mcg: mealItems.vitaminB12Mcg,
      vitaminB9Mcg: mealItems.vitaminB9Mcg,
      vitaminB5Mg: mealItems.vitaminB5Mg,
      vitaminB6Mg: mealItems.vitaminB6Mg,
      vitaminEMg: mealItems.vitaminEMg,
      vitaminKMcg: mealItems.vitaminKMcg,
    })
    .from(meals)
    .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
    .leftJoin(
      vietnameseFoodComposition,
      eq(mealItems.foodCompositionId, vietnameseFoodComposition.id)
    )
    .leftJoin(
      ingredientSources,
      eq(vietnameseFoodComposition.sourceId, ingredientSources.id)
    )
    .where(where);
}
